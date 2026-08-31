class_name BlitzballBall
extends RigidBody3D

signal goal_scored(is_home_goal: bool, shooter: Node3D)
signal ball_possessed(player: Node3D)
signal ball_freed()

@export var water_drag: float = 0.96
@export var max_arena_radius: float = 28.0

var is_held: bool = false
var holder: Node3D = null
var last_shooter: Node3D = null
var last_passer: Node3D = null
var pass_target: Node3D = null
var is_shot: bool = false
var shot_power: float = 0.0

@onready var pickup_area: Area3D = $PickupArea if has_node("PickupArea") else null

func _ready() -> void:
	gravity_scale = 0.0
	if pickup_area and not pickup_area.body_entered.is_connected(_on_body_entered_pickup):
		pickup_area.body_entered.connect(_on_body_entered_pickup)

func _physics_process(_delta: float) -> void:
	if is_held and holder != null:
		if holder.has_node("BallHoldPoint"):
			global_position = holder.get_node("BallHoldPoint").global_position
		else:
			global_position = holder.global_position + Vector3(0.0, 0.2, 0.8)
		linear_velocity = Vector3.ZERO
		return

	linear_velocity *= water_drag

	if global_position.length() > max_arena_radius:
		var normal: Vector3 = -global_position.normalized()
		linear_velocity = linear_velocity.bounce(normal) * 0.7
		global_position = global_position.normalized() * (max_arena_radius - 0.2)

func attach_to_player(player: Node3D) -> void:
	is_held = true
	holder = player
	is_shot = false
	freeze = true
	ball_possessed.emit(player)

func release_ball() -> void:
	is_held = false
	holder = null
	freeze = false
	ball_freed.emit()

func shoot(direction: Vector3, power: float, shooter: Node3D) -> void:
	release_ball()
	last_shooter = shooter
	is_shot = true
	shot_power = power
	linear_velocity = direction.normalized() * power

func pass_to_player(target: Node3D, speed: float, passer: Node3D) -> void:
	release_ball()
	last_passer = passer
	pass_target = target
	is_shot = false
	var dir: Vector3 = (target.global_position - global_position).normalized()
	linear_velocity = dir * speed

func trigger_goal(is_home_goal: bool) -> void:
	goal_scored.emit(is_home_goal, last_shooter)

func _on_body_entered_pickup(body: Node3D) -> void:
	if is_held:
		return
	if body.has_method("receive_ball"):
		body.receive_ball(self)
