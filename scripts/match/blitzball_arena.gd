class_name BlitzballArena
extends Node3D

@export var sphere_radius: float = 30.0
@export var goal_offset: float = 26.0

@onready var goal_home: Node3D = $GoalHome if has_node("GoalHome") else null
@onready var goal_away: Node3D = $GoalAway if has_node("GoalAway") else null
@onready var water_sphere: MeshInstance3D = $WaterSphere if has_node("WaterSphere") else null

func _ready() -> void:
	if water_sphere and water_sphere.mesh == null:
		var sphere_mesh := SphereMesh.new()
		sphere_mesh.radius = sphere_radius
		sphere_mesh.height = sphere_radius * 2.0
		water_sphere.mesh = sphere_mesh

func is_inside_sphere(world_pos: Vector3) -> bool:
	return world_pos.length() <= sphere_radius

func clamp_to_sphere(world_pos: Vector3, margin: float = 1.0) -> Vector3:
	var max_dist: float = sphere_radius - margin
	if world_pos.length() > max_dist:
		return world_pos.normalized() * max_dist
	return world_pos

func get_goal_position(is_home: bool) -> Vector3:
	if is_home:
		if goal_home:
			return goal_home.global_position
		return Vector3(-goal_offset, 0.0, 0.0)
	else:
		if goal_away:
			return goal_away.global_position
		return Vector3(goal_offset, 0.0, 0.0)
