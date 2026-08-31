class_name SeasonDashboard
extends Control

@onready var week_label: Label = $TopPanel/WeekLabel
@onready var standings_list: ItemList = $TabContainer/Standings/StandingsList
@onready var schedule_list: ItemList = $TabContainer/Schedule/ScheduleList
@onready var sim_btn: Button = $ActionPanel/SimWeekButton
@onready var play_btn: Button = $ActionPanel/PlayMatchButton
@onready var back_btn: Button = $TopPanel/BackButton

var season_mgr: SeasonManager = null

func _ready() -> void:
	season_mgr = SeasonManager.new()
	add_child(season_mgr)
	season_mgr.initialize_season()

	season_mgr.season_advanced.connect(_on_week_advanced)
	season_mgr.season_concluded.connect(_on_season_concluded)

	sim_btn.pressed.connect(_on_sim_pressed)
	play_btn.pressed.connect(_on_play_pressed)
	back_btn.pressed.connect(_on_back_pressed)

	_refresh_ui()

func _refresh_ui() -> void:
	week_label.text = "SEASON 1 - WEEK %d / %d" % [season_mgr.current_week, season_mgr.total_weeks]

	# Populate Standings
	standings_list.clear()
	for i in range(season_mgr.standings.size()):
		var s: Dictionary = season_mgr.standings[i]
		var entry := "%d. %-18s | PTS: %2d | W: %d  L: %d  D: %d | GD: %+d" % [
			i + 1, s["team_name"], s["points"], s["wins"], s["losses"], s["draws"], (s["goals_for"] - s["goals_against"])
		]
		standings_list.add_item(entry)

	# Populate Schedule
	schedule_list.clear()
	for m in season_mgr.schedule:
		if m["week"] == season_mgr.current_week:
			var h_name: String = TeamDatabase.teams[m["home_id"]].team_name
			var a_name: String = TeamDatabase.teams[m["away_id"]].team_name
			var result_str: String = "%d - %d" % [m["home_score"], m["away_score"]] if m["played"] else "VS"
			schedule_list.add_item("%s  %s  %s" % [h_name, result_str, a_name])

func _on_sim_pressed() -> void:
	season_mgr.simulate_week()
	_refresh_ui()

func _on_play_pressed() -> void:
	# Launch into user match
	GameManager.current_home_team_id = "besaid_aurochs"
	GameManager.current_away_team_id = "luca_goers"
	get_tree().change_scene_to_file("res://scenes/match/BlitzballMatch.tscn")

func _on_week_advanced(_week: int) -> void:
	_refresh_ui()

func _on_season_concluded(champ_id: String) -> void:
	var champ_name: String = TeamDatabase.teams[champ_id].team_name
	week_label.text = "CHAMPION: %s!" % champ_name
	sim_btn.disabled = true
	play_btn.disabled = true

func _on_back_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/MainMenu.tscn")
