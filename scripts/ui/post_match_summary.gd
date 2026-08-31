class_name PostMatchSummary
extends Control

@onready var final_score_label: Label = $Panel/FinalScoreLabel
@onready var winner_label: Label = $Panel/WinnerLabel
@onready var home_stats_label: RichTextLabel = $Panel/HomeStats
@onready var away_stats_label: RichTextLabel = $Panel/AwayStats
@onready var continue_btn: Button = $Panel/ContinueButton

func _ready() -> void:
	visible = false
	continue_btn.pressed.connect(_on_continue)

func display_results(home_team: BlitzballTeamData, away_team: BlitzballTeamData, h_score: int, a_score: int) -> void:
	visible = true

	final_score_label.text = "%s  %d   -   %d  %s" % [home_team.abbreviation, h_score, a_score, away_team.abbreviation]

	if h_score > a_score:
		winner_label.text = "%s WIN!" % home_team.team_name.to_upper()
		winner_label.modulate = Color(1.0, 0.85, 0.1)
	elif a_score > h_score:
		winner_label.text = "%s WIN!" % away_team.team_name.to_upper()
		winner_label.modulate = Color(0.9, 0.2, 0.2)
	else:
		winner_label.text = "DRAW MATCH"
		winner_label.modulate = Color(0.7, 0.7, 0.7)

	home_stats_label.text = "[b]%s[/b]\nGoals: %d\nTeam OVR: %d\nFan Morale: +5%%" % [home_team.team_name, h_score, home_team.get_average_overall()]
	away_stats_label.text = "[b]%s[/b]\nGoals: %d\nTeam OVR: %d\nFan Morale: -2%%" % [away_team.team_name, a_score, away_team.get_average_overall()]

func _on_continue() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/SeasonDashboard.tscn")
