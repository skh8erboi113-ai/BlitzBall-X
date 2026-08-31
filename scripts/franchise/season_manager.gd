class_name SeasonManager
extends Node

signal season_advanced(current_week: int)
signal season_concluded(champion_team_id: String)

var current_week: int = 1
var total_weeks: int = 10
var standings: Array[Dictionary] = []
var schedule: Array[Dictionary] = []

func initialize_season() -> void:
	standings.clear()
	schedule.clear()

	for team_id in TeamDatabase.teams.keys():
		var t: BlitzballTeamData = TeamDatabase.teams[team_id]
		standings.append({
			"team_id": team_id,
			"team_name": t.team_name,
			"wins": 0,
			"losses": 0,
			"draws": 0,
			"points": 0,
			"goals_for": 0,
			"goals_against": 0
		})

	_build_schedule()

func _build_schedule() -> void:
	var team_ids := TeamDatabase.teams.keys()
	var week_counter := 1

	for i in range(team_ids.size()):
		for j in range(i + 1, team_ids.size()):
			schedule.append({
				"week": (week_counter % total_weeks) + 1,
				"home_id": team_ids[i],
				"away_id": team_ids[j],
				"played": false,
				"home_score": 0,
				"away_score": 0
			})
			week_counter += 1

func simulate_week() -> void:
	for match_data in schedule:
		if match_data["week"] == current_week and not match_data["played"]:
			var home: BlitzballTeamData = TeamDatabase.teams[match_data["home_id"]]
			var away: BlitzballTeamData = TeamDatabase.teams[match_data["away_id"]]

			var h_pwr := home.get_average_overall() + randi_range(-10, 10)
			var a_pwr := away.get_average_overall() + randi_range(-10, 10)

			var h_score := maxi(0, int((h_pwr - 40) / 10) + randi_range(0, 2))
			var a_score := maxi(0, int((a_pwr - 40) / 10) + randi_range(0, 2))

			match_data["played"] = true
			match_data["home_score"] = h_score
			match_data["away_score"] = a_score

			_update_record(match_data["home_id"], h_score, a_score)
			_update_record(match_data["away_id"], a_score, h_score)

	_sort_standings()
	current_week += 1

	if current_week > total_weeks:
		season_concluded.emit(standings[0]["team_id"])
	else:
		season_advanced.emit(current_week)

func _update_record(t_id: String, scored: int, conceded: int) -> void:
	for row in standings:
		if row["team_id"] == t_id:
			row["goals_for"] += scored
			row["goals_against"] += conceded
			if scored > conceded:
				row["wins"] += 1
				row["points"] += 3
			elif scored < conceded:
				row["losses"] += 1
			else:
				row["draws"] += 1
				row["points"] += 1
			break

func _sort_standings() -> void:
	standings.sort_custom(func(a, b):
		if a["points"] != b["points"]:
			return a["points"] > b["points"]
		var diff_a: int = a["goals_for"] - a["goals_against"]
		var diff_b: int = b["goals_for"] - b["goals_against"]
		return diff_a > diff_b
	)
