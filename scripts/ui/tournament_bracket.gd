class_name TournamentBracketUI
extends Control

@onready var qf_list: ItemList = $BracketPanel/QFList
@onready var sf_list: ItemList = $BracketPanel/SFList
@onready var finals_label: Label = $BracketPanel/FinalsLabel
@onready var advance_btn: Button = $ActionPanel/AdvanceButton
@onready var back_btn: Button = $TopBar/BackButton

var tourney_mgr: TournamentManager = null

func _ready() -> void:
	tourney_mgr = TournamentManager.new()
	add_child(tourney_mgr)
	tourney_mgr.setup_tournament()

	advance_btn.pressed.connect(_on_advance)
	back_btn.pressed.connect(_on_back)

	_refresh_bracket()

func _refresh_bracket() -> void:
	qf_list.clear()
	for m in tourney_mgr.matches_round_1:
		var result := "%s vs %s" % [m["team_a"].abbreviation, m["team_b"].abbreviation]
		if m["played"]:
			result = "%s %d - %d %s (Winner: %s)" % [m["team_a"].abbreviation, m["score_a"], m["score_b"], m["team_b"].abbreviation, m["winner"].abbreviation]
		qf_list.add_item(result)

	sf_list.clear()
	for m in tourney_mgr.matches_round_2:
		var result := "%s vs %s" % [m["team_a"].abbreviation, m["team_b"].abbreviation]
		if m["played"]:
			result = "%s %d - %d %s" % [m["team_a"].abbreviation, m["score_a"], m["score_b"], m["team_b"].abbreviation]
		sf_list.add_item(result)

	if tourney_mgr.final_match.has("winner") and tourney_mgr.final_match["winner"] != null:
		finals_label.text = "SPIRA CUP CHAMPION: %s!" % tourney_mgr.final_match["winner"].team_name
	else:
		finals_label.text = "FINALS: TBD"

func _on_advance() -> void:
	match tourney_mgr.current_stage:
		TournamentManager.Stage.QUARTER_FINALS:
			for m in tourney_mgr.matches_round_1:
				if not m["played"]:
					tourney_mgr.simulate_match(m)
			# Build Semis
			tourney_mgr.matches_round_2.append({
				"team_a": tourney_mgr.matches_round_1[0]["winner"],
				"team_b": tourney_mgr.matches_round_1[1]["winner"],
				"score_a": 0, "score_b": 0, "winner": null, "played": false
			})
			tourney_mgr.matches_round_2.append({
				"team_a": tourney_mgr.matches_round_1[2]["winner"],
				"team_b": tourney_mgr.matches_round_1[3]["winner"],
				"score_a": 0, "score_b": 0, "winner": null, "played": false
			})
			tourney_mgr.current_stage = TournamentManager.Stage.SEMI_FINALS
		TournamentManager.Stage.SEMI_FINALS:
			for m in tourney_mgr.matches_round_2:
				if not m["played"]:
					tourney_mgr.simulate_match(m)
			# Build Finals
			tourney_mgr.final_match = {
				"team_a": tourney_mgr.matches_round_2[0]["winner"],
				"team_b": tourney_mgr.matches_round_2[1]["winner"],
				"score_a": 0, "score_b": 0, "winner": null, "played": false
			}
			tourney_mgr.current_stage = TournamentManager.Stage.FINALS
		TournamentManager.Stage.FINALS:
			tourney_mgr.simulate_match(tourney_mgr.final_match)
			tourney_mgr.current_stage = TournamentManager.Stage.FINISHED
			advance_btn.disabled = true

	_refresh_bracket()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/MainMenu.tscn")
