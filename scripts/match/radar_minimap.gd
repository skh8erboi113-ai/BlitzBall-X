class_name RadarMinimap
extends Control

@export var radar_radius: float = 65.0
@export var arena_world_radius: float = 30.0

var home_players: Array[Node3D] = []
var away_players: Array[Node3D] = []
var ball_node: Node3D = null

func _ready() -> void:
	custom_minimum_size = Vector2(radar_radius * 2.0 + 10.0, radar_radius * 2.0 + 10.0)

func setup(home: Array[BlitzballPlayer], away: Array[BlitzballPlayer], ball: BlitzballBall) -> void:
	home_players.clear()
	away_players.clear()
	for p in home:
		home_players.append(p)
	for p in away:
		away_players.append(p)
	ball_node = ball

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var center := size * 0.5

	# Draw radar boundary sphere projection
	draw_circle(center, radar_radius, Color(0.05, 0.15, 0.3, 0.6))
	draw_arc(center, radar_radius, 0.0, TAU, 48, Color(0.2, 0.6, 1.0, 0.8), 2.0)
	draw_line(Vector2(center.x, center.y - radar_radius), Vector2(center.x, center.y + radar_radius), Color(0.2, 0.6, 1.0, 0.3), 1.0)
	draw_line(Vector2(center.x - radar_radius, center.y), Vector2(center.x + radar_radius, center.y), Color(0.2, 0.6, 1.0, 0.3), 1.0)

	# Draw home players (Yellow/Blue dots)
	for p in home_players:
		if is_instance_valid(p):
			var pos_2d := _project_3d_to_radar(p.global_position, center)
			draw_circle(pos_2d, 4.0, Color(1.0, 0.85, 0.1))

	# Draw away players (Red dots)
	for p in away_players:
		if is_instance_valid(p):
			var pos_2d := _project_3d_to_radar(p.global_position, center)
			draw_circle(pos_2d, 4.0, Color(0.9, 0.2, 0.2))

	# Draw blitzball (Glowing cyan/white dot)
	if is_instance_valid(ball_node):
		var ball_pos_2d := _project_3d_to_radar(ball_node.global_position, center)
		draw_circle(ball_pos_2d, 5.0, Color(1.0, 1.0, 1.0))
		draw_circle(ball_pos_2d, 3.0, Color(0.1, 0.9, 1.0))

func _project_3d_to_radar(world_pos: Vector3, center: Vector2) -> Vector2:
	var norm_x: float = world_pos.x / arena_world_radius
	var norm_z: float = world_pos.z / arena_world_radius
	return center + Vector2(norm_x, norm_z) * radar_radius
