class_name MatchManager
extends Node3D

@onready var arena: Node3D = $BlitzballArena
@onready var ball: RigidBody3D = $Ball
@onready var camera: Camera3D = $Camera3D
@onready var hud: CanvasLayer = $HUD

var home_team: Resource
var away_team: Resource
var home_players: Array = []
var away_players: Array = []
var user_player: Node3D = null

var home_score: int = 0
var away_score: int = 0
var match_timer: float = 0.0
var half_duration: float = 300.0
var is_match_active: bool = false

func _ready() -> void:
	home_team = TeamDatabase.teams.get(GameManager.current_home_team_id)
	away_team = TeamDatabase.teams.get(GameManager.current_away_team_id)

	_spawn_team(home_team, true)
	_spawn_team(away_team, false)

	if ball:
		ball.connect("goal_scored", _on_goal_scored)

	_setup_user_player()
	is_match_active = true

func _process(delta: float) -> void:
	if is_match_active:
		match_timer += delta
		if Input.is_action_just_pressed("switch_player"):
			_switch_user_player()

func _spawn_team(team_data: Resource, is_home: bool) -> void:
	var player_scene := preload("res://Player.tscn")
	var sign_mult: float = -1.0 if is_home else 1.0

	var positions_offset := [
		Vector3(sign_mult * 24.0, 0.0, 0.0),    # GK
		Vector3(sign_mult * 15.0, 4.0, -6.0),   # LD
		Vector3(sign_mult * 15.0, 4.0, 6.0),    # RD
		Vector3(sign_mult * 5.0, 0.0, 0.0),     # MF
		Vector3(sign_mult * -8.0, -3.0, -5.0),  # LF
		Vector3(sign_mult * -8.0, -3.0, 5.0)    # RF
	]

	var team_roster: Array = team_data.get("roster")
	for i in range(mini(team_roster.size(), 6)):
		var p = player_scene.instantiate()
		p.set("player_data", team_roster[i])
		p.set("is_home_team", is_home)
		p.set("ball_ref", ball)
		add_child(p)
		p.global_position = positions_offset[i]

		if is_home:
			home_players.append(p)
		else:
			away_players.append(p)

func _setup_user_player() -> void:
	if not home_players.is_empty():
		user_player = home_players[0]
		user_player.set("is_user_controlled", true)
		if camera:
			camera.set("target", user_player)

func _switch_user_player() -> void:
	if home_players.is_empty():
		return
	var idx := home_players.find(user_player)
	user_player.set("is_user_controlled", false)
	idx = (idx + 1) % home_players.size()
	user_player = home_players[idx]
	user_player.set("is_user_controlled", true)
	if camera:
		camera.set("target", user_player)

func get_teammates(player: Node3D) -> Array:
	return home_players if player.get("is_home_team") else away_players

func get_ball_carrier() -> Node3D:
	if ball and ball.get("is_held") and ball.get("holder") != null:
		return ball.get("holder") as Node3D
	return null

func _on_goal_scored(is_home_goal: bool, _shooter: Node3D) -> void:
	if is_home_goal:
		away_score += 1
	else:
		home_score += 1
	ball.global_position = Vector3.ZERO
	ball.linear_velocity = Vector3.ZERO
	ball.call("release_ball")
