class_name FreeAgencyUI
extends Control

@onready var agent_list: ItemList = $MainPanel/AgentList
@onready var details_label: RichTextLabel = $MainPanel/DetailsLabel
@onready var sign_btn: Button = $MainPanel/SignButton
@onready var budget_label: Label = $TopBar/BudgetLabel
@onready var back_btn: Button = $TopBar/BackButton

var scouting_mgr: Node = null
var current_team: Resource = null
var selected_agent: Resource = null

func _ready() -> void:
	var scouting_script = preload("res://scouting_manager.gd")
	scouting_mgr = scouting_script.new()
	add_child(scouting_mgr)

	current_team = TeamDatabase.teams.get(GameManager.current_home_team_id)
	back_btn.pressed.connect(_on_back)
	sign_btn.pressed.connect(_on_sign_agent)
	agent_list.item_selected.connect(_on_agent_selected)

	_refresh_ui()

func _refresh_ui() -> void:
	if current_team:
		budget_label.text = "TEAM BUDGET: %d Gil" % current_team.get("budget")

	agent_list.clear()
	var list_agents: Array = scouting_mgr.get("free_agents")
	for i in range(list_agents.size()):
		var a = list_agents[i]
		var pos_num: int = a.get("position")
		var item_str := "FA | %-16s | OVR: %2d | Cost: %4d Gil" % [
			a.get("first_name"), a.call("get_overall_rating"), a.get("salary")
		]
		agent_list.add_item(item_str)

	if list_agents.size() > 0:
		agent_list.select(0)
		_on_agent_selected(0)
	else:
		details_label.text = "No free agents available for scout."
		sign_btn.disabled = true

func _on_agent_selected(index: int) -> void:
	var list_agents: Array = scouting_mgr.get("free_agents")
	if index < 0 or index >= list_agents.size():
		return

	selected_agent = list_agents[index]
	var text := "[b][font_size=22]%s[/font_size][/b]\n" % selected_agent.call("get_full_name")
	text += "OVR: %d\n" % selected_agent.call("get_overall_rating")
	text += "Wage Requirement: [color=yellow]%d Gil[/color]\n\n" % selected_agent.get("salary")
	text += "SPD: %d | SHT: %d | PAS: %d | TCK: %d\n\n" % [
		selected_agent.get("speed"), selected_agent.get("shooting"), selected_agent.get("passing"), selected_agent.get("tackling")
	]
	details_label.text = text

	sign_btn.disabled = (current_team.get("budget") < selected_agent.get("salary"))

func _on_sign_agent() -> void:
	if selected_agent and current_team:
		if scouting_mgr.call("sign_free_agent", current_team, selected_agent):
			_refresh_ui()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://season_dashboard.tscn")
