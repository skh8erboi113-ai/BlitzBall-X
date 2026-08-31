class_name CrowdSimulation
extends Node3D

@export var ring_radius: float = 34.0
@export var spectator_count: int = 120

var spectators: Array[MeshInstance3D] = []

func _ready() -> void:
	_generate_crowd_ring()

func _generate_crowd_ring() -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.5, 1.2, 0.4)

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.15, 0.4, 0.8)
	mat.roughness = 0.8

	for i in range(spectator_count):
		var angle: float = (float(i) / float(spectator_count)) * TAU
		var inst := MeshInstance3D.new()
		inst.mesh = mesh
		inst.material_override = mat

		var height_variance := randf_range(-4.0, 4.0)
		var x: float = cos(angle) * (ring_radius + randf_range(-1.0, 2.0))
		var z: float = sin(angle) * (ring_radius + randf_range(-1.0, 2.0))
		inst.position = Vector3(x, height_variance, z)

		inst.look_at(Vector3(0.0, 0.0, 0.0), Vector3.UP)
		add_child(inst)
		spectators.append(inst)

func cheer_reaction() -> void:
	for s in spectators:
		var t := create_tween()
		var orig_y := s.position.y
		t.tween_property(s, "position:y", orig_y + 1.2, 0.15 + randf() * 0.1)
		t.tween_property(s, "position:y", orig_y, 0.25)
