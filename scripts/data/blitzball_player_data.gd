class_name BlitzballPlayerData
extends Resource

enum Position {
	GOALKEEPER,
	LEFT_DEFENDER,
	RIGHT_DEFENDER,
	MIDFIELDER,
	LEFT_FORWARD,
	RIGHT_FORWARD
}

@export var player_id: String = ""
@export var first_name: String = ""
@export var last_name: String = ""
@export var nickname: String = ""
@export var age: int = 20
@export var position: Position = Position.MIDFIELDER
@export var team_id: String = ""

@export var shooting: int = 50
@export var passing: int = 50
@export var dribbling: int = 50
@export var finishing: int = 50

@export var tackling: int = 50
@export var blocking: int = 50
@export var interception: int = 50

@export var speed: int = 50
@export var acceleration: int = 50
@export var endurance: int = 50
@export var strength: int = 50

@export var reflexes: int = 50
@export var reach: int = 50
@export var positioning_gk: int = 50

@export var awareness: int = 50
@export var composure: int = 50
@export var aggression: int = 50

@export var learned_techniques: Array[String] = []

@export var salary: int = 100
@export var contract_years: int = 1
@export var morale: float = 75.0
@export var experience: int = 0
@export var level: int = 1

var current_hp: float = 100.0
var max_hp: float = 100.0
var is_benched: bool = false
var match_stats: Dictionary = {}

func get_overall_rating() -> int:
	var total: float = 0.0
	match position:
		Position.GOALKEEPER:
			total = reflexes * 0.25 + reach * 0.2 + positioning_gk * 0.2 + strength * 0.1 + composure * 0.15 + endurance * 0.1
		Position.LEFT_DEFENDER, Position.RIGHT_DEFENDER:
			total = tackling * 0.2 + blocking * 0.15 + interception * 0.15 + speed * 0.1 + strength * 0.15 + awareness * 0.1 + passing * 0.1 + endurance * 0.05
		Position.MIDFIELDER:
			total = passing * 0.2 + dribbling * 0.15 + awareness * 0.15 + speed * 0.1 + shooting * 0.1 + tackling * 0.1 + endurance * 0.1 + composure * 0.1
		Position.LEFT_FORWARD, Position.RIGHT_FORWARD:
			total = shooting * 0.25 + finishing * 0.2 + speed * 0.15 + dribbling * 0.1 + acceleration * 0.1 + composure * 0.1 + strength * 0.05 + passing * 0.05
	return roundi(total)

func get_full_name() -> String:
	if nickname != "":
		return "%s \"%s\" %s" % [first_name, nickname, last_name]
	if last_name != "":
		return "%s %s" % [first_name, last_name]
	return first_name

func reset_for_match() -> void:
	max_hp = float(endurance * 2 + 50)
	current_hp = max_hp
	match_stats = {
		"goals": 0,
		"assists": 0,
		"tackles": 0,
		"saves": 0,
		"shots": 0,
		"passes_completed": 0,
		"distance_swum": 0.0
	}
