class_name GoalkeeperController
extends Node

@export var dive_speed: float = 14.0
@export var max_guard_radius: float = 4.5

var player: BlitzballPlayer = null
var goal_center: Vector3 = Vector3.ZERO
var is_diving: bool = false
var dive_target: Vector3 = Vector3.ZERO

func setup(gk_player: BlitzballPlayer, goal_position: Vector3) -> void:
	player = gk_player
	goal_center = goal_position

func _physics_process(delta: float) -> void:
	if not player or not is_instance_valid(player):
		return

	if is_diving:
		_process_dive(delta)
	else:
		_process_guard_position(delta)

func _process_guard_position(delta: float) -> void:
	var ball := player.ball_ref
	if not ball:
		return

	# Position relative to line of sight from ball to goal
	var ball_to_goal := (ball.global_position - goal_center).normalized()
	var ideal_pos := goal_center + (ball_to_goal * 2.0)

	# Constrain within goalmouth box
	var offset := ideal_pos - goal_center
	offset.y = clampf(offset.y, -max_guard_radius, max_guard_radius)
	offset.z = clampf(offset.z, -max_guard_radius, max_guard_radius)
	ideal_pos = goal_center + offset

	player.velocity = player.velocity.lerp((ideal_pos - player.global_position) * 6.0, delta * 8.0)

	# Watch incoming shots
	if ball.is_shot:
		_attempt_save(ball)

func _attempt_save(ball: BlitzballBall) -> void:
	var dist := player.global_position.distance_to(ball.global_position)
	if dist < 12.0 and not is_diving:
		is_diving = true
		dive_target = ball.global_position

		# Attribute stat calculations (CAT / Reflexes)
		var reflexes: float = player.player_data.reflexes if player.player_data else 50.0
		var catch_success_prob: float = (reflexes / (ball.shot_power + reflexes)) + 0.15

		if randf() < catch_success_prob:
			# Successfully block or catch
			get_tree().create_timer(0.25).timeout.connect(func():
				if is_instance_valid(ball) and is_instance_valid(player):
					player.receive_ball(ball)
					is_diving = false
			)
		else:
			# Dive miss
			get_tree().create_timer(0.8).timeout.connect(func():
				is_diving = false
			)

func _process_dive(delta: float) -> void:
	var dir := (dive_target - player.global_position).normalized()
	player.velocity = dir * dive_speed * delta * 60.0
