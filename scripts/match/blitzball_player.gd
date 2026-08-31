class_name BlitzballPlayer
extends CharacterBody3D

signal ball_received(player: BlitzballPlayer)
signal pass_made(passer: BlitzballPlayer, receiver: BlitzballPlayer)

enum State { IDLE, SWIMMING, DRIBBLING, CHASING, SHOOTING, PASSING, TACKLING, TACKLED }
var current_state: State = State.IDLE

@export var base_swim_speed: float = 12.0
@export var rotation_speed: float = 8.0

var player_data: BlitzballPlayerData
var is_user_controlled: bool = false
var is_home_team: bool = true
var has_ball: bool = false
var ball_ref: BlitzballBall = null

var shot_charge: float = 0.0
var is_charging_shot: bool = false
var tackle_cooldown: float = 0.0

@onready var model: Node3D = $Model if has_node("Model") else self
@onready var name_label: Label3D = $NameLabel if has_node("NameLabel") else null
@onready var ball_hold_point: Marker3D = $Model/BallHoldPoint if has_node("Model/BallHoldPoint") else null

func _ready() -> void:
	if player_data:
		player_data.reset_for_match()
		if name_label:
			name_label.text = player_data.first_name

func _physics_process(delta: float) -> void:
	if is_user_controlled:
		_process_user(delta)
	else:
		_process_ai(delta)

	velocity *= 0.92
	_clamp_to_bounds()
	move_and_slide()

	if tackle_cooldown > 0.0:
		tackle_cooldown = maxf(tackle_cooldown - delta, 0.0)

	if is_charging_shot:
		shot_charge = minf(shot_charge + delta * 1.5, 1.0)

func _process_user(delta: float) -> void:
	var move_vec := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var vert_axis := Input.get_axis("swim_down", "swim_up")

	var cam := get_viewport().get_camera_3d()
	if not cam:
		return

	var cam_fwd := -cam.global_basis.z
	cam_fwd.y = 0.0
	cam_fwd = cam_fwd.normalized()
	var cam_right := cam.global_basis.x
	cam_right.y = 0.0
	cam_right = cam_right.normalized()

	var move_dir := (cam_right * move_vec.x + cam_fwd * -move_vec.y).normalized()
	move_dir.y = vert_axis

	if move_dir.length() > 0.1:
		move_dir = move_dir.normalized()
		var spd := base_swim_speed * (player_data.speed / 50.0 if player_data else 1.0)
		if Input.is_action_pressed("sprint"):
			spd *= 1.4
			if player_data:
				player_data.current_hp = maxf(player_data.current_hp - delta * 4.0, 0.0)
		velocity = velocity.lerp(move_dir * spd, delta * 5.0)
		_face_direction(move_dir, delta)

	if has_ball:
		if Input.is_action_just_pressed("shoot"):
			is_charging_shot = true
			shot_charge = 0.0
		if Input.is_action_just_released("shoot"):
			_release_shot()
		if Input.is_action_just_pressed("pass"):
			_perform_pass()
	else:
		if Input.is_action_just_pressed("tackle"):
			_perform_tackle()

func _process_ai(delta: float) -> void:
	if not ball_ref:
		return
	if has_ball:
		var target_goal := Vector3(26.0, 0.0, 0.0) if is_home_team else Vector3(-26.0, 0.0, 0.0)
		var dir := (target_goal - global_position).normalized()
		velocity = velocity.lerp(dir * base_swim_speed * 0.7, delta * 3.0)
		_face_direction(dir, delta)
		if global_position.distance_to(target_goal) < 14.0 and randf() < 0.02:
			_release_shot()
	else:
		if not ball_ref.is_held:
			var dir := (ball_ref.global_position - global_position).normalized()
			velocity = velocity.lerp(dir * base_swim_speed * 0.8, delta * 3.0)
			_face_direction(dir, delta)

func _face_direction(dir: Vector3, delta: float) -> void:
	if dir.length() > 0.1 and model:
		var look_target := global_position + dir
		var target_t := model.global_transform.looking_at(look_target, Vector3.UP)
		model.global_transform = model.global_transform.interpolate_with(target_t, rotation_speed * delta)

func _clamp_to_bounds() -> void:
	if global_position.length() > 28.0:
		global_position = global_position.normalized() * 28.0

func receive_ball(ball: BlitzballBall) -> void:
	has_ball = true
	ball_ref = ball
	ball.attach_to_player(self)
	ball_received.emit(self)

func _release_shot() -> void:
	if not has_ball or not ball_ref:
		return
	is_charging_shot = false
	var target_goal := Vector3(26.0, 0.0, 0.0) if is_home_team else Vector3(-26.0, 0.0, 0.0)
	var dir := (target_goal - global_position).normalized()
	var pwr := (15.0 + (player_data.shooting / 99.0 if player_data else 0.5) * 20.0) * maxf(shot_charge, 0.5)
	has_ball = false
	ball_ref.shoot(dir, pwr, self)

func _perform_pass() -> void:
	if not has_ball or not ball_ref:
		return
	var match_node := get_parent()
	if match_node and match_node.has_method("get_teammates"):
		var mates: Array = match_node.get_teammates(self)
		for mate in mates:
			if mate != self:
				has_ball = false
				ball_ref.pass_to_player(mate, 18.0, self)
				pass_made.emit(self, mate)
				return

func _perform_tackle() -> void:
	if tackle_cooldown > 0.0:
		return
	tackle_cooldown = 1.5
	var match_node := get_parent()
	if match_node and match_node.has_method("get_ball_carrier"):
		var carrier: BlitzballPlayer = match_node.get_ball_carrier()
		if carrier and carrier.is_home_team != is_home_team and global_position.distance_to(carrier.global_position) < 4.0:
			carrier.has_ball = false
			receive_ball(carrier.ball_ref)
