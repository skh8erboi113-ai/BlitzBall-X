class_name TechniqueManager
extends Node

enum TechType { SHOT, PASS, TACKLE, DRIBBLE }

class TechData:
	var id: String
	var name: String
	var type: TechType
	var hp_cost: float
	var power_bonus: float

var techniques: Dictionary = {}

func _ready() -> void:
	_register("Sphere Shot", TechType.SHOT, 30.0, 12.0)
	_register("Jecht Shot", TechType.SHOT, 120.0, 30.0)
	_register("Venom Shot", TechType.SHOT, 40.0, 8.0)
	_register("Invisible Shot", TechType.SHOT, 60.0, 18.0)
	_register("Nap Pass", TechType.PASS, 20.0, 10.0)
	_register("Venom Tackle", TechType.TACKLE, 30.0, 15.0)
	_register("Drain Tackle", TechType.TACKLE, 25.0, 10.0)

func _register(t_name: String, t_type: TechType, cost: float, pwr: float) -> void:
	var t := TechData.new()
	t.id = t_name.to_lower().replace(" ", "_")
	t.name = t_name
	t.type = t_type
	t.hp_cost = cost
	t.power_bonus = pwr
	techniques[t_name] = t

func can_use(player: BlitzballPlayer, tech_name: String) -> bool:
	if not techniques.has(tech_name):
		return false
	var tech: TechData = techniques[tech_name]
	if not player.player_data:
		return false
	return player.player_data.current_hp >= tech.hp_cost

func execute_shot(player: BlitzballPlayer, tech_name: String, target_goal: Vector3) -> bool:
	if not can_use(player, tech_name):
		return false

	var tech: TechData = techniques[tech_name]
	player.player_data.current_hp -= tech.hp_cost

	var dir := (target_goal - player.global_position).normalized()
	var base_stat: float = player.player_data.shooting if player.player_data else 50.0
	var final_power: float = 20.0 + (base_stat / 99.0) * 15.0 + tech.power_bonus

	if tech_name == "Jecht Shot":
		var opponents := get_tree().get_nodes_in_group("players")
		var knocked := 0
		for opp in opponents:
			if opp is BlitzballPlayer and opp.is_home_team != player.is_home_team:
				if player.global_position.distance_to(opp.global_position) < 6.0 and knocked < 2:
					var knock_dir := (opp.global_position - player.global_position).normalized()
					opp.velocity = knock_dir * 18.0
					knocked += 1

	player.has_ball = false
	if player.ball_ref:
		player.ball_ref.shoot(dir, final_power, player)

	return true
