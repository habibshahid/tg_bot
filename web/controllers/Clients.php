<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Clients extends MY_Controller {

    function addAuditLog($controller = '', $view='index'){
        $valid = array(
            'ip_address' => $this->input->ip_address(),
            'username' => $this->session->userdata('username'),
            'controller' => $controller,
            'view' => $view,
            'data' => ($_POST) ? json_encode($_POST) : '',
        );
        $this->audit_model->addLog($valid);
    }
	
	function __construct()
	{
		parent::__construct();
		$this->load->driver('Session');
		$this->load->helper('language');
		$this->load->library('upload');
		$this->load->model('clients_model');
		$this->load->model('rate_cards_model');
		$this->load->model('gateways_model');
		$this->load->model('lists_model');
		$this->load->model('moh_model');
		$this->load->model('ivrs_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'User Management';
		$result['menu'] = 'clients';
		$result['users'] = $this->clients_model->getUsers();
		$this->addAuditLog('clients','index');
		$this->load->view('clients/clients', $result);
	}
	
	// New method for approval management dashboard
	public function approvals()
	{
		$result['title'] = 'User Approvals & Campaign Settings';
		$result['menu'] = 'clients';
		
		// Get clients in different stages
		$result['pending_users'] = $this->clients_model->getPendingApprovals();
		$result['awaiting_config'] = $this->clients_model->getUsersAwaitingCampaignSettings();
		$result['campaign_ready'] = $this->clients_model->getUsers(); // Filter for campaign ready users
		
		// Filter campaign ready users
		$result['campaign_ready'] = array_filter($result['campaign_ready'], function($user) {
			return $user->approval_status == 'approved' && $user->campaign_settings_complete;
		});
		
		// Get SIP trunks for configuration
		$result['sip_trunks'] = $this->gateways_model->getGateways();
		
		$this->addAuditLog('clients','approvals');
		$this->load->view('clients/approvals', $result);
	}
	
	// Approve user via AJAX
	public function approve_user()
	{
		header('Content-Type: application/json');
		
		if (!$this->input->post('user_id')) {
			echo json_encode(array('success' => false, 'message' => 'User ID required'));
			return;
		}
		
		$user_id = $this->input->post('user_id');
		$admin_username = $this->session->userdata('username');
		
		$result = $this->clients_model->approveUser($user_id, $admin_username);
		
		if ($result) {
			$this->addAuditLog('clients', 'approve-user');
			echo json_encode(array('success' => true, 'message' => 'User approved successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to approve user'));
		}
	}
	
	// Reject user via AJAX
	public function reject_user()
	{
		header('Content-Type: application/json');
		
		if (!$this->input->post('user_id')) {
			echo json_encode(array('success' => false, 'message' => 'User ID required'));
			return;
		}
		
		$user_id = $this->input->post('user_id');
		$admin_username = $this->session->userdata('username');
		
		$result = $this->clients_model->rejectUser($user_id, $admin_username);
		
		if ($result) {
			$this->addAuditLog('clients', 'reject-user');
			echo json_encode(array('success' => true, 'message' => 'User rejected successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to reject user'));
		}
	}
	
	// Set campaign settings via AJAX
	public function set_campaign_settings()
	{
		header('Content-Type: application/json');
		
		if (!$this->input->post('user_id')) {
			echo json_encode(array('success' => false, 'message' => 'User ID required'));
			return;
		}
		
		$user_id = $this->input->post('user_id');
		$settings = array(
			'sip_trunk_id' => $this->input->post('sip_trunk_id'),
			'callback_trunk_id' => $this->input->post('callback_trunk_id'),
			'caller_id' => $this->input->post('caller_id'),
			'dial_prefix' => $this->input->post('dial_prefix'),
			'concurrent_calls' => $this->input->post('concurrent_calls')
		);
		
		// Validation
		if (empty($settings['sip_trunk_id']) || empty($settings['caller_id']) || empty($settings['concurrent_calls'])) {
			echo json_encode(array('success' => false, 'message' => 'SIP Trunk, Caller ID, and Concurrent Calls are required'));
			return;
		}
		
		$result = $this->clients_model->setCampaignSettings($user_id, $settings);
		
		if ($result) {
			$this->addAuditLog('clients', 'set-campaign-settings');
			echo json_encode(array('success' => true, 'message' => 'Campaign settings saved successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to save campaign settings'));
		}
	}
	
	// API endpoint for Telegram bot to check user readiness
	public function api_check_campaign_ready()
	{
		header('Content-Type: application/json');
		
		$telegram_id = $this->input->post('telegram_id');
		if (!$telegram_id) {
			echo json_encode(array('ready' => false, 'message' => 'Telegram ID required'));
			return;
		}
		
		$user = $this->clients_model->isUserReadyForCampaign($telegram_id);
		
		if ($user) {
			// Get complete campaign data
			$campaign_data = $this->clients_model->getUserCampaignData($telegram_id);
			echo json_encode(array(
				'ready' => true,
				'user' => $campaign_data
			));
		} else {
			echo json_encode(array('ready' => false, 'message' => 'User not ready for campaign'));
		}
	}
	
	// API endpoint for Telegram bot to get user status
	public function api_get_user_status()
	{
		header('Content-Type: application/json');
		
		$telegram_id = $this->input->post('telegram_id');
		if (!$telegram_id) {
			echo json_encode(array('found' => false, 'message' => 'Telegram ID required'));
			return;
		}
		
		$user = $this->clients_model->getUserByTelegramId($telegram_id);
		
		if ($user) {
			echo json_encode(array(
				'found' => true,
				'user' => array(
					'id' => $user->id,
					'username' => $user->username,
					'first_name' => $user->first_name,
					'status' => $user->status,
					'approval_status' => $user->approval_status,
					'campaign_settings_complete' => $user->campaign_settings_complete,
					'balance' => $user->balance,
					'rate_card_name' => $user->rate_card_name
				)
			));
		} else {
			echo json_encode(array('found' => false, 'message' => 'User not found'));
		}
	}
	
	public function manage_agents($user_id = 0)
	{
		if(!$user_id) {
			redirect('clients');
		}
		
		$result['title'] = 'Manage User Agents';
		$result['menu'] = 'clients';
		$result['user'] = $this->clients_model->getUser($user_id);
		$result['associated_agents'] = $this->clients_model->getUserAssociatedAgents($user_id);
		$result['available_agents'] = $this->clients_model->getAvailableAgents();
		
		$this->addAuditLog('clients', 'manage-agents');
		$this->load->view('clients/manage_agents', $result);
	}
	
	public function manage_trunks($user_id = 0)
	{
		if(!$user_id) {
			redirect('clients');
		}
		
		$result['title'] = 'Manage User Trunks';
		$result['menu'] = 'clients';
		$result['user'] = $this->clients_model->getUserTrunk($user_id);
		$result['associated_agents'] = $this->clients_model->getUserAssociatedTrunks($user_id);
		$result['available_agents'] = $this->clients_model->getAvailableTrunks();
		
		$this->addAuditLog('clients', 'manage-trunks');
		$this->load->view('clients/manage_trunks', $result);
	}

	// AJAX method to associate agent with user
	public function associate_agent()
	{
		header('Content-Type: application/json');
		
		$user_id = $this->input->post('user_id');
		$agent_id = $this->input->post('agent_id');
		
		if(!$user_id || !$agent_id) {
			echo json_encode(array('success' => false, 'message' => 'User ID and Agent ID required'));
			return;
		}
		
		// Check if agent is already associated with another user
		$existing = $this->clients_model->getAgentAssociation($agent_id);
	
		if($existing && $existing->telegram_id != '' && $existing->telegram_id != $user_id) {
			echo json_encode(array('success' => false, 'message' => 'Agent is already associated with another user'));
			return;
		}
		
		$result = $this->clients_model->associateAgent($user_id, $agent_id);
		
		if($result) {
			$this->addAuditLog('clients', 'associate-agent');
			echo json_encode(array('success' => true, 'message' => 'Agent associated successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to associate agent'));
		}
	}
	
	public function associate_trunk()
	{
		header('Content-Type: application/json');
		
		$user_id = $this->input->post('user_id');
		$agent_id = $this->input->post('agent_id');
		
		if(!$user_id || !$agent_id) {
			echo json_encode(array('success' => false, 'message' => 'User ID and Agent ID required'));
			return;
		}
		
		// Check if agent is already associated with another user
		$existing = $this->clients_model->getTrunkAssociation($agent_id);
	
		if($existing && $existing->telegram_id != '' && $existing->telegram_id != $user_id) {
			echo json_encode(array('success' => false, 'message' => 'Trunk is already associated with another user'));
			return;
		}
		
		$result = $this->clients_model->associateTrunk($user_id, $agent_id);
		
		if($result) {
			$this->addAuditLog('clients', 'associate-trunk');
			echo json_encode(array('success' => true, 'message' => 'Trunk associated successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to associate agent'));
		}
	}

	// AJAX method to remove agent association
	public function remove_agent_association()
	{
		header('Content-Type: application/json');
		
		$agent_id = $this->input->post('agent_id');
		
		if(!$agent_id) {
			echo json_encode(array('success' => false, 'message' => 'Agent ID required'));
			return;
		}
		
		$result = $this->clients_model->removeAgentAssociation($agent_id);
		
		if($result) {
			$this->addAuditLog('clients', 'remove-agent-association');
			echo json_encode(array('success' => true, 'message' => 'Agent association removed successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to remove association'));
		}
	}
	
	public function remove_trunk_association()
	{
		header('Content-Type: application/json');
		
		$agent_id = $this->input->post('agent_id');
		
		if(!$agent_id) {
			echo json_encode(array('success' => false, 'message' => 'Trunk ID required'));
			return;
		}
		
		$result = $this->clients_model->removeTrunkAssociation($agent_id);
		
		if($result) {
			$this->addAuditLog('clients', 'remove-trunk-association');
			echo json_encode(array('success' => true, 'message' => 'Trunk association removed successfully'));
		} else {
			echo json_encode(array('success' => false, 'message' => 'Failed to remove association'));
		}
	}

	// AJAX method to get user's associated agents for destination selection
	public function get_user_agents()
	{
		header('Content-Type: application/json');
		
		$user_id = $this->input->post('user_id');
		
		if(!$user_id) {
			echo json_encode(array('success' => false, 'message' => 'User ID required'));
			return;
		}
		
		$agents = $this->clients_model->getUserAssociatedAgents($user_id);
		echo json_encode(array('success' => true, 'agents' => $agents));
	}
	
	public function get_user_trunks()
	{
		header('Content-Type: application/json');
		
		$user_id = $this->input->post('user_id');
		
		if(!$user_id) {
			echo json_encode(array('success' => false, 'message' => 'User ID required'));
			return;
		}
		
		$agents = $this->clients_model->getUserAssociatedTrunks($user_id);
		echo json_encode(array('success' => true, 'agents' => $agents));
	}

	public function get_available_agents()
	{
		header('Content-Type: application/json');
		
		$sql = "SELECT s.id, s.name, s.defaultuser, s.username, s.description, s.category
				FROM sippeers s 
				WHERE s.category != 'trunk' 
				AND s.status = 1 
				AND (s.telegram_id IS NULL OR s.telegram_id = '')
				ORDER BY s.name ASC";
		
		$query = $this->db->query($sql);
		$agents = $query->result();
		
		echo json_encode(array('success' => true, 'agents' => $agents));
	}
	
	public function get_available_trunks()
	{
		header('Content-Type: application/json');
		
		$sql = "SELECT s.id, s.name, s.defaultuser, s.username, s.description, s.category
				FROM sippeers s 
				WHERE s.category = 'trunk' 
				AND s.status = 1 
				AND (s.telegram_id IS NULL OR s.telegram_id = '')
				ORDER BY s.name ASC";
		
		$query = $this->db->query($sql);
		$agents = $query->result();
		
		echo json_encode(array('success' => true, 'agents' => $agents));
	}
	
	public function add(){
		$result['title'] = 'Add User';
		$result['menu'] = 'clients';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		$result['sip_trunks'] = $this->gateways_model->getGateways();
		$result['available_agents'] = $this->getUnassignedAgents();
		
		if($this->input->post()){
			$this->addAuditLog('clients','add-user');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('username', 'Username', 'required|is_unique[users.username]');
			$this->form_validation->set_rules('email', 'Email', 'valid_email|is_unique[users.email]');
			$this->form_validation->set_rules('first_name', 'First Name', 'required');
			$this->form_validation->set_rules('password', 'Password', 'required|min_length[6]');
			$this->form_validation->set_rules('destination_type', 'Destination Type', 'required');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$this->load->view('clients/add', $result);
			} else {
				$post_data = $this->input->post();
				
				// Handle destination route based on type
				if($post_data['destination_type'] == 'trunk' && !empty($post_data['destination_trunk'])) {
					$post_data['destination_route'] = 'trunk/' . $post_data['destination_trunk'];
				} elseif($post_data['destination_type'] == 'agent' && !empty($post_data['destination_agent'])) {
					// Get agent name for destination route
					$agent = $this->db->get_where('sippeers', array('id' => $post_data['destination_agent']))->row();
					if($agent) {
						$post_data['destination_route'] = 'agent/' . $agent->name;
					}
				}
				
				$result_id = $this->clients_model->addUserWithAgent($post_data);
				if($result_id){
					$this->session->set_flashdata('message', 'User Added Successfully - Pending Approval');
					redirect('clients/approvals', 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Unable to Add User');
					$this->load->view('clients/add', $result);
				}
			}
		}else{
			$this->load->view('clients/add', $result);
		}
	}

	// Update the existing edit method
	// Update the existing edit method to use user's associated agents
	public function edit($id=0){
		$result['title'] = 'Edit User';
		$result['menu'] = 'clients';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		$result['sip_trunks'] = $this->gateways_model->getGateways();
		$result['user_agents'] = $this->clients_model->getUserAssociatedAgents($id);
		$result['user_trunks'] = $this->clients_model->getUserAssociatedTrunks($id);
		//echo '<pre>';print_r($result);die;
		if($this->input->post()){
			$this->addAuditLog('clients','edit-user');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('username', 'Username', 'required');
			$this->form_validation->set_rules('email', 'Email', 'valid_email');
			$this->form_validation->set_rules('first_name', 'First Name', 'required');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$result['fields'] = $this->clients_model->getUser($id);
				$this->load->view('clients/edit', $result);
			} else {
				$post_data = $this->input->post();
				
				// Handle destination route based on type
				if($post_data['destination_type'] == 'trunk' && !empty($post_data['destination_trunk'])) {
					$post_data['destination_route'] = 'trunk/' . $post_data['destination_trunk'];
				} elseif($post_data['destination_type'] == 'agent' && !empty($post_data['destination_agent'])) {
					// Get agent name for destination route
					$post_data['destination_route'] = 'agent/' . $post_data['destination_agent'];
				} else {
					$post_data['destination_route'] = null;
				}
				//echo '<pre>';print_r($post_data);die;
				$result_update = $this->clients_model->editUser($post_data, $id);
				if($result_update){
					$this->session->set_flashdata('message', 'User Updated Successfully');
					redirect('clients', 'refresh');
				}else{
					$result['fields'] = $this->clients_model->getUser($id);
					$this->load->view('clients/edit', $result);
				}
			}
		}else{
			$result['fields'] = $this->clients_model->getUser($id);
			$this->load->view('clients/edit', $result);
		}
	}

	// Helper method to get unassigned agents
	private function getUnassignedAgents($exclude_user_id = null) {
		$this->db->select('id, name, defaultuser, username, description, category');
		$this->db->from('sippeers');
		$this->db->where('category !=', 'trunk');
		$this->db->where('status', 1);
		
		if($exclude_user_id) {
			// Include current user's agent in the list
			$current_user = $this->clients_model->getUser($exclude_user_id);
			if($current_user && $current_user->destination_route && strpos($current_user->destination_route, 'agent/') === 0) {
				$agent_name = str_replace('agent/', '', $current_user->destination_route);
				$this->db->where("(telegram_id IS NULL OR telegram_id = '' OR telegram_id = '$exclude_user_id' OR name = '$agent_name')", NULL, FALSE);
			} else {
				$this->db->where("(telegram_id IS NULL OR telegram_id = '' OR telegram_id = '$exclude_user_id')", NULL, FALSE);
			}
		} else {
			$this->db->where('(telegram_id IS NULL OR telegram_id = "")', NULL, FALSE);
		}
		
		$this->db->order_by('name', 'ASC');
		return $this->db->get()->result();
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete User';
		$result['menu'] = 'clients';
		if($this->input->post()){
			$this->addAuditLog('clients','delete-user');
			$result_delete = $this->clients_model->deleteUser($this->input->post());
			if($result_delete){
				$this->session->set_flashdata('message', 'User Deleted Successfully');
				redirect('clients', 'refresh');
			}
		}else{
			$result['fields'] = $this->clients_model->getUser($id);
			$this->load->view('clients/delete', $result);
		}
	}
	
	public function credit_management($id=0){
		$result['title'] = 'Credit Management';
		$result['menu'] = 'clients';
		$result['user'] = $this->clients_model->getUser($id);
		$result['transactions'] = $this->clients_model->getUserTransactions($id);
		
		if($this->input->post()){
			$this->addAuditLog('clients','credit-management');
			
			$this->load->library('form_validation');
			$this->form_validation->set_rules('amount', 'Amount', 'required|numeric');
			$this->form_validation->set_rules('transaction_type', 'Transaction Type', 'required');
			$this->form_validation->set_rules('description', 'Description', 'required');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
			} else {
				$transaction_data = $this->input->post();
				$transaction_data['user_id'] = $id;
				$transaction_data['created_by'] = $this->session->userdata('username');
				
				$result_transaction = $this->clients_model->addTransaction($transaction_data);
				if($result_transaction){
					$this->session->set_flashdata('message', 'Transaction Added Successfully');
					redirect('clients/credit_management/'.$id, 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Unable to Process Transaction');
				}
			}
		}
		
		$this->load->view('clients/credit_management', $result);
	}
	
	public function assign_rate_card($id=0){
		$result['title'] = 'Assign Rate Card';
		$result['menu'] = 'clients';
		$result['user'] = $this->clients_model->getUser($id);
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		
		if($this->input->post()){
			$this->addAuditLog('clients','assign-rate-card');
			$result_assign = $this->clients_model->assignRateCard($id, $this->input->post('rate_card_id'));
			if($result_assign){
				$this->session->set_flashdata('message', 'Rate Card Assigned Successfully');
				redirect('clients', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Assign Rate Card');
			}
		}
		
		$this->load->view('clients/assign_rate_card', $result);
	}
}