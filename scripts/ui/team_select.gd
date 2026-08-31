class_name TeamSelect
extends Control

@onready var home_label: Label = $Panel/HomeTeamLabel
@onready var away_label: Label = $Panel/AwayTeamLabel
@onready var start_button: Button = $StartButton
@onready var back_button: Button = $BackButton

var team_keys: Array = []
var home_idx: int = 0
var away_idx: int = 1

func _ready() -> void:
	team_keys = TeamDatabase.teams.keys()
	if team_keys.size() < 2:
		return

	_update_labels()
	start_button.pressed.connect(_on_start_match)
	back_button.pressed.connect(_on_back)

	$Panel/HomePrev.pressed.connect(func(): _cycle_home(-1))
	$Panel/HomeNext.pressed.connect(func(): _cycle_home(1))
	$Panel/AwayPrev.pressed.connect(func(): _cycle_away(-1))
	$Panel/AwayNext.pressed.connect(func(): _cycle_away(1))

func _cycle_home(dir: int) -> void:
	home_idx = posmod(home_idx + dir, team_keys.size())
	if home_idx == away_idx:
		home_idx = posmod(home_idx + dir, team_keys.size())
	_update_labels()

func _cycle_away(dir: int) -> void:
	away_idx = posmod(away_idx + dir, team_keys.size())
	if away_idx == home_idx:
		away_idx = posmod(away_idx + dir, team_keys.size())
	_update_labels()

func _update_labels() -> void:
	var home_t: BlitzballTeamData = TeamDatabase.teams[team_keys[home_idx]]
	var away_t: BlitzballTeamData = TeamDatabase.teams[team_keys[away_idx]]
	home_label.text = "%s (OVR: %d)" % [home_t.team_name, home_t.get_average_overall()]
	away_label.text = "%s (OVR: %d)" % [away_t.team_name, away_t.get_average_overall()]

func _on_start_match() -> void:
	GameManager.current_home_team_id = team_keys[home_idx]
	GameManager.current_away_team_id = team_keys[away_idx]
	get_tree().change_scene_to_file("res://scenes/match/BlitzballMatch.tscn")

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/MainMenu.tscn")
