class_name TournamentManager
extends Node

signal round_completed(round_name: String)
signal tournament_won(champion_team: BlitzballTeamData)

enum Stage { QUARTER_FINALS, SEMI_FINALS, FINALS, FINISHED }
var current_stage: Stage = Stage.QUARTER_FINALS

var matches_round_1: Array[Dictionary] = []
var matches_round_2: Array[Dictionary] = []
var final_match: Dictionary = {}

func setup_tournament() -> void:
	var team_keys: Array = TeamDatabase.teams.keys()
	team_keys.shuffle()

	matches_round_1.clear()
	matches_round_2.clear()
	final_match.clear()

	# Quarter finals: 4 matches
	for i in range(0, 4):
		var t1: BlitzballTeamData = TeamDatabase.teams[team_keys[i % team_keys.size()]]
		var t2: BlitzballTeamData = TeamDatabase.teams[team_keys[(i + 1) % team_keys.size()]]
		matches_round_1.append({
			"team_a": t1, "team_b": t2, "score_a": 0, "score_b": 0, "winner": null, "played": false
		})

	current_stage = Stage.QUARTER_FINALS

func simulate_match(match_dict: Dictionary) -> void:
	var pwr_a: int = match_dict["team_a"].get_average_overall() + randi_range(-8, 8)
	var pwr_b: int = match_dict["team_b"].get_average_overall() + randi_range(-8, 8)

	var score_a := maxi(0, int((pwr_a - 40) / 12) + randi_range(0, 2))
	var score_b := maxi(0, int((pwr_b - 40) / 12) + randi_range(0, 2))

	# Tiebreaker rule
	if score_a == score_b:
		if pwr_a >= pwr_b:
			score_a += 1
		else:
			score_b += 1

	match_dict["score_a"] = score_a
	match_dict["score_b"] = score_b
	match_dict["winner"] = match_dict["team_a"] if score_a > score_b else match_dict["team_b"]
	match_dict["played"] = true
