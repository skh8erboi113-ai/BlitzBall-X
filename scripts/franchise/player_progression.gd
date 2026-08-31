class_name PlayerProgression
extends Node

signal player_leveled_up(player: BlitzballPlayerData, new_level: int)

func calculate_match_xp(player: BlitzballPlayerData) -> int:
	var xp_earned := 50 # Base participation XP

	if player.match_stats.has("goals"):
		xp_earned += player.match_stats["goals"] * 40
	if player.match_stats.has("assists"):
		xp_earned += player.match_stats["assists"] * 25
	if player.match_stats.has("tackles"):
		xp_earned += player.match_stats["tackles"] * 15
	if player.match_stats.has("saves"):
		xp_earned += player.match_stats["saves"] * 30

	return xp_earned

func apply_xp(player: BlitzballPlayerData, xp_amount: int) -> bool:
	player.experience += xp_amount
	var xp_required: int = player.level * 150

	if player.experience >= xp_required:
		player.experience -= xp_required
		player.level += 1
		_distribute_stat_upgrade(player)
		player_leveled_up.emit(player, player.level)
		return true

	return false

func _distribute_stat_upgrade(player: BlitzballPlayerData) -> void:
	match player.position:
		BlitzballPlayerData.Position.LEFT_FORWARD, BlitzballPlayerData.Position.RIGHT_FORWARD:
			player.shooting = mini(99, player.shooting + randi_range(1, 2))
			player.speed = mini(99, player.speed + 1)
			player.finishing = mini(99, player.finishing + 1)
		BlitzballPlayerData.Position.MIDFIELDER:
			player.passing = mini(99, player.passing + randi_range(1, 2))
			player.dribbling = mini(99, player.dribbling + 1)
			player.tackling = mini(99, player.tackling + 1)
		BlitzballPlayerData.Position.LEFT_DEFENDER, BlitzballPlayerData.Position.RIGHT_DEFENDER:
			player.tackling = mini(99, player.tackling + randi_range(1, 2))
			player.blocking = mini(99, player.blocking + 1)
			player.strength = mini(99, player.strength + 1)
		BlitzballPlayerData.Position.GOALKEEPER:
			player.reflexes = mini(99, player.reflexes + randi_range(1, 2))
			player.reach = mini(99, player.reach + 1)
			player.positioning_gk = mini(99, player.positioning_gk + 1)
