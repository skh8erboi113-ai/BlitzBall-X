extends Node

var current_home_team_id: String = "besaid_aurochs"
var current_away_team_id: String = "luca_goers"
var match_duration: float = 300.0 # 5 minutes

func _ready() -> void:
	Engine.max_fps = 60
