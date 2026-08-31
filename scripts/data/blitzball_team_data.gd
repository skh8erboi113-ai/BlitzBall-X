class_name BlitzballTeamData
extends Resource

@export var team_id: String = ""
@export var team_name: String = ""
@export var city: String = ""
@export var abbreviation: String = ""
@export var primary_color: Color = Color(0.1, 0.4, 0.9)
@export var secondary_color: Color = Color(1.0, 1.0, 1.0)
@export var logo_texture: Texture2D

@export var roster: Array[BlitzballPlayerData] = []
@export var starting_lineup: Dictionary = {}

@export var wins: int = 0
@export var losses: int = 0
@export var draws: int = 0
@export var goals_for: int = 0
@export var goals_against: int = 0
@export var budget: int = 10000
@export var fan_support: float = 50.0
@export var championships: int = 0

func get_starter(pos: BlitzballPlayerData.Position) -> BlitzballPlayerData:
	var target_id: String = starting_lineup.get(pos, "")
	if target_id != "":
		for player in roster:
			if player and player.player_id == target_id:
				return player
	
	for player in roster:
		if player and player.position == pos and not player.is_benched:
			return player
	
	return null

func get_average_overall() -> int:
	if roster.is_empty():
		return 0
	var total: int = 0
	for player in roster:
		if player:
			total += player.get_overall_rating()
	return roundi(float(total) / float(roster.size()))
