extends Node

const PlayerDataClass = preload("res://blitzball_player_data.gd")
const TeamDataClass = preload("res://blitzball_team_data.gd")

var teams: Dictionary = {}

func _ready() -> void:
	_init_teams()

func _init_teams() -> void:
	var besaid = TeamDataClass.new()
	besaid.team_id = "besaid_aurochs"
	besaid.team_name = "Besaid Aurochs"
	besaid.city = "Besaid"
	besaid.abbreviation = "BES"
	besaid.primary_color = Color(1.0, 0.75, 0.0)
	besaid.secondary_color = Color(0.0, 0.4, 0.8)

	var tidus = _make_player("tidus", "Tidus", "", 3, 82, 75, 80, 85, 50, 45, 55, 85, 88, 70, 60, 50, 50, 50, 78, 72, 65, ["Sphere Shot", "Jecht Shot"])
	var wakka = _make_player("wakka", "Wakka", "", 3, 70, 82, 68, 65, 72, 60, 70, 55, 50, 80, 75, 50, 50, 50, 85, 80, 55, ["Venom Shot"])
	var datto = _make_player("datto", "Datto", "", 5, 45, 50, 40, 42, 30, 25, 35, 60, 55, 50, 35, 50, 50, 50, 40, 35, 30, [])
	var letty = _make_player("letty", "Letty", "", 1, 30, 45, 35, 28, 52, 48, 45, 40, 38, 55, 50, 50, 50, 50, 42, 40, 55, [])
	var jassu = _make_player("jassu", "Jassu", "", 2, 28, 42, 30, 25, 50, 45, 42, 38, 35, 52, 48, 50, 50, 50, 38, 42, 50, [])
	var keepa = _make_player("keepa", "Keepa", "", 0, 10, 35, 20, 10, 20, 30, 30, 25, 22, 60, 55, 45, 50, 42, 40, 38, 20, [])

	besaid.roster = [tidus, wakka, datto, letty, jassu, keepa]
	teams["besaid_aurochs"] = besaid

	var luca = TeamDataClass.new()
	luca.team_id = "luca_goers"
	luca.team_name = "Luca Goers"
	luca.city = "Luca"
	luca.abbreviation = "LUC"
	luca.primary_color = Color(0.8, 0.1, 0.1)
	luca.secondary_color = Color(0.9, 0.9, 0.9)

	var bickson = _make_player("bickson", "Bickson", "", 4, 75, 60, 72, 78, 55, 40, 45, 70, 72, 65, 68, 50, 50, 50, 65, 60, 72, ["Venom Shot"])
	var graav = _make_player("graav", "Graav", "", 3, 65, 72, 70, 60, 68, 55, 65, 68, 65, 72, 70, 50, 50, 50, 75, 70, 60, [])
	var abus = _make_player("abus", "Abus", "", 5, 68, 55, 65, 70, 45, 35, 40, 72, 70, 60, 62, 50, 50, 50, 58, 55, 65, [])
	var balgerda = _make_player("balgerda", "Balgerda", "", 1, 35, 50, 40, 30, 72, 65, 60, 55, 52, 70, 72, 50, 50, 50, 55, 62, 70, ["Venom Tackle"])
	var doram = _make_player("doram", "Doram", "", 2, 30, 48, 38, 28, 70, 62, 58, 52, 50, 68, 70, 50, 50, 50, 52, 58, 68, [])
	var raudy = _make_player("raudy", "Raudy", "", 0, 15, 40, 25, 12, 25, 35, 35, 30, 28, 65, 60, 72, 68, 70, 60, 65, 25, [])

	luca.roster = [bickson, graav, abus, balgerda, doram, raudy]
	teams["luca_goers"] = luca

func _make_player(id: String, first: String, last: String, pos_val: int,
				sh: int, pa: int, dr: int, fi: int,
				ta: int, bl: int, ic: int,
				sp: int, ac: int, en: int, st: int,
				rf: int, rc: int, pg: int,
				aw: int, co: int, ag: int, techs: Array[String]) -> Resource:
	var p = PlayerDataClass.new()
	p.player_id = id
	p.first_name = first
	p.last_name = last
	p.position = pos_val
	p.shooting = sh
	p.passing = pa
	p.dribbling = dr
	p.finishing = fi
	p.tackling = ta
	p.blocking = bl
	p.interception = ic
	p.speed = sp
	p.acceleration = ac
	p.endurance = en
	p.strength = st
	p.reflexes = rf
	p.reach = rc
	p.positioning_gk = pg
	p.awareness = aw
	p.composure = co
	p.aggression = ag
	p.learned_techniques = techs
	return p
