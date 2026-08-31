class_name MatchCamera
extends Camera3D

@export var follow_offset := Vector3(0.0, 4.0, 10.0)
@export var follow_speed: float = 6.0
@export var look_speed: float = 10.0

var target: Node3D = null

func _process(delta: float) -> void:
	if not target:
		return

	var target_pos := target.global_position + follow_offset
	global_position = global_position.lerp(target_pos, follow_speed * delta)

	var target_transform := global_transform.looking_at(target.global_position, Vector3.UP)
	global_transform = global_transform.interpolate_with(target_transform, look_speed * delta)
