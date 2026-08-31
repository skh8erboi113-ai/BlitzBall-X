class_name ScoutingManager
extends Node

var free_agents: Array[BlitzballPlayerData] = []

func _ready() -> void:
	_init_free_agent_pool()

func _init_free_agent_pool() -> void:
	# Classic Spira free agents available for contract hire
	free_agents.append(_make_agent("brother", "Brother", "", BlitzballPlayerData.Position.MIDFIELDER, 60, 75, 78, 55, 65, 50, 60, 96, 95, 80, 58, ["Sphere Shot"]))
	free_agents.append(_make_agent("nimrook", "Nimrook", "", BlitzballPlayerData.Position.GOALKEEPER, 10, 30, 20, 10, 20, 20, 20, 60, 60, 70, 70, [], 88, 85, 86))
	free_agents.append(_make_agent("ropp", "Ropp", "", BlitzballPlayerData.Position.LEFT_DEFENDER, 25, 70, 45, 20, 84, 78, 75, 62, 60, 75, 74, ["Venom Tackle", "Drain Tackle"]))
	free_agents.append(_make_agent("wedge", "Wedge", "", BlitzballPlayerData.Position.RIGHT_FORWARD, 78, 40, 62, 75, 45, 30, 35, 68, 65, 60, 65, []))
	free_agents.append(_make_agent("linna", "Linna", "", BlitzballPlayerData.Position.MIDFIELDER, 72, 85, 60, 65, 55, 45, 50, 65, 62, 70, 50, ["Nap Pass"]))

func _make_agent(id: String, first: String, last: String, pos: BlitzballPlayerData.Position,
				sh: int, pa: int, dr: int, fi: int,
				ta: int, bl: int, ic: int,
				sp: int, ac: int, en: int, st: int,
				techs: Array[String], rf: int = 50, rc: int = 50, pg: int = 50) -> BlitzballPlayerData:
	var p := BlitzballPlayerData.new()
	p.player_id = id
	p.first_name = first
	p.last_name = last
	p.position = pos
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
	p.salary = (sp + sh + ta + rf) * 2
	p.contract_years = 2
	p.learned_techniques = techs
	return p

func sign_free_agent(team: BlitzballTeamData, agent: BlitzballPlayerData) -> bool:
	if team.budget < agent.salary:
		return false

	team.budget -= agent.salary
	free_agents.erase(agent)
	team.roster.append(agent)
	return true
