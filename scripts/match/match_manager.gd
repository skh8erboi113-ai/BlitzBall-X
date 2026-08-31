class_name MatchManager
extends Node3D

@onready var arena: BlitzballArena = $BlitzballArena
@onready var ball: BlitzballBall = $Ball
@onready var camera: MatchCamera = $Camera3D
@onready var hud: CanvasLayer = $HUD

var home_team: BlitzballTeamData
var away_team: BlitzballTeamData
var home_players: Array[BlitzballPlayer] = []
var away_players: Array[BlitzballPlayer] = []
var user_player: BlitzballPlayer = null

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
		ball.goal_scored.connect(_on_goal_scored)

	_setup_user_player()
	is_match_active = true

func _process(delta: float) -> void:
	if is_match_active:
		match_timer += delta
		if Input.is_action_just_pressed("switch_player"):
			_switch_user_player()

func _spawn_team(team_data: BlitzballTeamData, is_home: bool) -> void:
	var player_scene := preload("res://scenes/match/Player.tscn")
	var sign_mult: float = -1.0 if is_home else 1.0

	var positions_offset := [
		Vector3(sign_mult * 24.0, 0.0, 0.0),    # GK
		Vector3(sign_mult * 15.0, 4.0, -6.0),   # LD
		Vector3(sign_mult * 15.0, 4.0, 6.0),    # RD
		Vector3(sign_mult * 5.0, 0.0, 0.0),     # MF
		Vector3(sign_mult * -8.0, -3.0, -5.0),  # LF
		Vector3(sign_mult * -8.0, -3.0, 5.0)    # RF
	]

	for i in range(mini(team_data.roster.size(), 6)):
		var p: BlitzballPlayer = player_scene.instantiate()
		p.player_data = team_data.roster[i]
		p.is_home_team = is_home
		p.ball_ref = ball
		add_child(p)
		p.global_position = positions_offset[i]

		if is_home:
			home_players.append(p)
		else:
			away_players.append(p)

func _setup_user_player() -> void:
	if not home_players.is_empty():
		user_player = home_players[0]
		user_player.is_user_controlled = true
		if camera:
			camera.target = user_player

func _switch_user_player() -> void:
	if home_players.is_empty():
		return
	var idx := home_players.find(user_player)
	user_player.is_user_controlled = false
	idx = (idx + 1) % home_players.size()
	user_player = home_players[idx]
	user_player.is_user_controlled = true
	if camera:
		camera.target = user_player

func get_teammates(player: BlitzballPlayer) -> Array[BlitzballPlayer]:
	return home_players if player.is_home_team else away_players

func get_ball_carrier() -> BlitzballPlayer:
	if ball and ball.is_held and ball.holder is BlitzballPlayer:
		return ball.holder as BlitzballPlayer
	return null

func _on_goal_scored(is_home_goal: bool, _shooter: Node3D) -> void:
	if is_home_goal:
		away_score += 1
	else:
		home_score += 1
	ball.global_position = Vector3.ZERO
	ball.linear_velocity = Vector3.ZERO
	ball.release_ball()
