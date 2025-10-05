<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Clients_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getUsers(){
		$this->db->select('
			u.*,
			rc.name as rate_card_name,
			rc.currency,
			st.name as sip_trunk_name,
			ct.name as callback_trunk_name,
			(SELECT COUNT(*) FROM call_details cd WHERE cd.user_id = u.id) as total_calls,
			(SELECT SUM(cd.sell_price) FROM call_details cd WHERE cd.user_id = u.id) as total_spent
		',FALSE);
        $this->db->from('users as u');
		$this->db->join('rate_cards as rc', 'rc.id = u.rate_card_id', 'left');
		$this->db->join('sippeers as st', 'st.id = u.sip_trunk_id', 'left');
		$this->db->join('sippeers as ct', 'ct.id = u.callback_trunk_id', 'left');
		$this->db->order_by('u.created_at', 'DESC');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	private function getUnassignedAgents($exclude_user_id = null) {
		$this->db->select('s.id, s.name, s.defaultuser, s.username, s.description, s.category');
		$this->db->from('sippeers as s');
		$this->db->where('s.category !=', 'trunk');
		$this->db->where('s.status', 1);
		
		if($exclude_user_id) {
			// Include current user's agent in the list
			$current_user = $this->clients_model->getUser($exclude_user_id);
			if($current_user && $current_user->destination_route && strpos($current_user->destination_route, 'agent/') === 0) {
				$agent_name = str_replace('agent/', '', $current_user->destination_route);
				$this->db->where("(s.telegram_id IS NULL OR s.telegram_id = '' OR s.telegram_id = '$exclude_user_id' OR s.name = '$agent_name')", NULL, FALSE);
			} else {
				$this->db->where("(s.telegram_id IS NULL OR s.telegram_id = '' OR s.telegram_id = '$exclude_user_id')", NULL, FALSE);
			}
		} else {
			$this->db->where('(s.telegram_id IS NULL OR s.telegram_id = "")', NULL, FALSE);
		}
		
		$this->db->order_by('s.name', 'ASC');
		return $this->db->get()->result();
	}
	
	private function getUnassignedTrunks($exclude_user_id = null) {
		$this->db->select('s.id, s.name, s.defaultuser, s.username, s.description, s.category');
		$this->db->from('sippeers as s');
		$this->db->where('s.category =', 'trunk');
		$this->db->where('s.status', 1);
		
		if($exclude_user_id) {
			// Include current user's trunk in the list
			$current_user = $this->clients_model->getUser($exclude_user_id);
			if($current_user && $current_user->destination_route && strpos($current_user->destination_route, 'trunk/') === 0) {
				$agent_name = str_replace('trunk/', '', $current_user->destination_route);
				$this->db->where("(s.telegram_id IS NULL OR s.telegram_id = '' OR s.telegram_id = '$exclude_user_id' OR s.name = '$agent_name')", NULL, FALSE);
			} else {
				$this->db->where("(s.telegram_id IS NULL OR s.telegram_id = '' OR s.telegram_id = '$exclude_user_id')", NULL, FALSE);
			}
		} else {
			$this->db->where('(s.telegram_id IS NULL OR s.telegram_id = "")', NULL, FALSE);
		}
		
		$this->db->order_by('s.name', 'ASC');
		return $this->db->get()->result();
	}

	function addUserWithAgent($data = array()){
		$dataArray = $data;
		$dataArray['password'] = password_hash($dataArray['password'], PASSWORD_DEFAULT);
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		$dataArray['status'] = 'active';
		$dataArray['balance'] = isset($dataArray['balance']) ? $dataArray['balance'] : 0.0000;
		$dataArray['credit_limit'] = isset($dataArray['credit_limit']) ? $dataArray['credit_limit'] : 0.0000;
		$dataArray['approval_status'] = 'pending';
		$dataArray['campaign_settings_complete'] = FALSE;
		
		// Remove agent selection fields that shouldn't go in users table
		$destination_type = isset($dataArray['destination_type']) ? $dataArray['destination_type'] : null;
		$destination_agent = isset($dataArray['destination_agent']) ? $dataArray['destination_agent'] : null;
		unset($dataArray['destination_type'], $dataArray['destination_trunk'], $dataArray['destination_agent']);
		
		// Start transaction
		$this->db->trans_start();
		
		// Insert user
		$this->db->insert('users', $dataArray);
		$user_id = $this->db->insert_id();
		
		// If agent is selected, associate it with this user
		if($destination_type == 'agent' && $destination_agent && $user_id) {
			$this->db->where('id', $destination_agent);
			$this->db->update('sippeers', array('telegram_id' => $user_id));
		}
		
		$this->db->trans_complete();
		
		if ($this->db->trans_status() === FALSE) {
			return false;
		}
		
		return $user_id;
	}

	function editUserWithAgent($data=array(), $id=0){
		$dataArray = $data;
		$dataArray['updated_at'] = date('Y-m-d H:i:s');
		
		// Only update password if provided
		if(!empty($dataArray['password'])){
			$dataArray['password'] = password_hash($dataArray['password'], PASSWORD_DEFAULT);
		} else {
			unset($dataArray['password']);
		}
		
		// Get current user data
		$current_user = $this->getUser($id);
		
		// Handle agent assignment changes
		$destination_type = isset($dataArray['destination_type']) ? $dataArray['destination_type'] : null;
		$destination_agent = isset($dataArray['destination_agent']) ? $dataArray['destination_agent'] : null;
		
		// Remove fields that shouldn't go in users table
		unset($dataArray['user_id'], $dataArray['destination_type'], $dataArray['destination_trunk'], $dataArray['destination_agent']);
		
		// Check if campaign settings are complete
		if(isset($dataArray['sip_trunk_id']) && isset($dataArray['caller_id']) && 
		   isset($dataArray['concurrent_calls']) && $dataArray['sip_trunk_id'] && 
		   $dataArray['caller_id'] && $dataArray['concurrent_calls']){
			$dataArray['campaign_settings_complete'] = TRUE;
		}
		
		// Start transaction
		$this->db->trans_start();
		
		// Update user
		$this->db->where('id', $id);
		$this->db->update('users', $dataArray);
		
		// Handle agent association changes
		if($destination_type == 'agent' && $destination_agent) {
			// First, remove current user's association from any agent
			$this->db->where('telegram_id', $id);
			$this->db->update('sippeers', array('telegram_id' => null));
			
			// Then assign new agent to this user
			$this->db->where('id', $destination_agent);
			$this->db->update('sippeers', array('telegram_id' => $id));
		} elseif($destination_type == 'trunk') {
			// If switching to trunk, remove agent association
			$this->db->where('telegram_id', $id);
			$this->db->update('sippeers', array('telegram_id' => null));
		}
		
		$this->db->trans_complete();
		
		return ($this->db->trans_status() !== FALSE);
	}

	// Get all agents associated with a specific user
	function getUserAssociatedAgents($user_id) {
		$this->db->select('s.id, s.name, s.defaultuser, s.username, s.description, s.category, s.status');
		$this->db->from('sippeers s');
		$this->db->where('s.telegram_id', $user_id);
		$this->db->where('s.category !=', 'trunk');
		$this->db->order_by('s.name', 'ASC');
		
		$query = $this->db->get();
		return $query->result();
	}
	
	function getUserAssociatedTrunks($user_id) {
		$this->db->select('s.id, s.name, s.defaultuser, s.username, s.description, s.category, s.status');
		$this->db->from('sippeers s');
		$this->db->where('s.telegram_id', $user_id);
		$this->db->where('s.category =', 'trunk');
		$this->db->order_by('s.name', 'ASC');
		
		$query = $this->db->get();
		return $query->result();
	}

	// Get all available agents (not associated with any user)
	function getAvailableAgents() {
		$this->db->select('s.id, s.name, s.defaultuser, s.username, s.description, s.category, s.status');
		$this->db->from('sippeers s');
		$this->db->where('s.category !=', 'trunk');
		$this->db->where('s.status', 1);
		$this->db->where('(s.telegram_id IS NULL OR s.telegram_id = "")', NULL, FALSE);
		$this->db->order_by('s.name', 'ASC');
		
		$query = $this->db->get();
		return $query->result();
	}
	
	function getAvailableTrunks() {
		$this->db->select('s.id, s.name, s.defaultuser, s.username, s.description, s.category, s.status');
		$this->db->from('sippeers s');
		$this->db->where('s.category =', 'trunk');
		$this->db->where('s.status', 1);
		$this->db->where('(s.telegram_id IS NULL OR s.telegram_id = "")', NULL, FALSE);
		$this->db->order_by('s.name', 'ASC');
		
		$query = $this->db->get();
		return $query->result();
	}

	// Associate an agent with a user
	function associateAgent($user_id, $agent_id) {
		$this->db->where('id', $agent_id);
		$this->db->update('sippeers', array('telegram_id' => $user_id));
		return ($this->db->affected_rows() > 0);
	}
	
	function associateTrunk($user_id, $agent_id) {
		$this->db->where('id', $agent_id);
		$this->db->update('sippeers', array('telegram_id' => $user_id));
		return ($this->db->affected_rows() > 0);
	}

	// Remove agent association
	function removeAgentAssociation($agent_id) {
		$this->db->where('id', $agent_id);
		$this->db->update('sippeers', array('telegram_id' => null));
		return ($this->db->affected_rows() > 0);
	}
	
	function removeTrunkAssociation($agent_id) {
		$this->db->where('id', $agent_id);
		$this->db->where('category', 'trunk');
		$this->db->update('sippeers', array('telegram_id' => null));
		return ($this->db->affected_rows() > 0);
	}

	// Get agent association info
	function getAgentAssociation($agent_id) {
		$this->db->select('telegram_id');
		$this->db->where('id', $agent_id);
		$query = $this->db->get('sippeers');
		
		if($query->num_rows() > 0) {
			return $query->row();
		}
		return null;
	}
	
	function getTrunkAssociation($agent_id) {
		$this->db->select('telegram_id');
		$this->db->where('id', $agent_id);
		$this->db->where('category', 'trunk');
		$query = $this->db->get('sippeers');
		
		if($query->num_rows() > 0) {
			return $query->row();
		}
		return null;
	}

	// Update getUser method to include agent information
	function getUser($id=0){
		$sql = "SELECT 
			u.*,
			rc.name as rate_card_name,
			rc.currency,
			st.name as sip_trunk_name,
			st.host as sip_trunk_host,
			ct.name as callback_trunk_name,
			ct.host as callback_trunk_host
		FROM users u
		LEFT JOIN rate_cards rc ON rc.id = u.rate_card_id
		LEFT JOIN sippeers st ON st.id = u.sip_trunk_id
		LEFT JOIN sippeers ct ON ct.id = u.callback_trunk_id  
		WHERE u.id = ?";
		
		$query = $this->db->query($sql, array($id));
		
		if($query->num_rows() > 0){
			$user = $query->row();
			
			// Get current destination agent info if set
			if($user->destination_route && strpos($user->destination_route, 'agent/') === 0) {
				$agent_name = str_replace('agent/', '', $user->destination_route);
				
				$agent_query = $this->db->select('id, name, defaultuser')
									   ->where('name', $agent_name)
									   ->where('telegram_id', $id)
									   ->get('sippeers');
				
				if($agent_query->num_rows() > 0) {
					$agent = $agent_query->row();
					$user->current_destination_agent_id = $agent->id;
					$user->current_destination_agent_name = $agent->name;
					$user->current_destination_agent_extension = $agent->defaultuser;
				}
			}
			
			return $user;
		} else {
			return array();
		}
	}
	
	function getUserTrunk($id=0){
		$sql = "SELECT 
			u.*,
			rc.name as rate_card_name,
			rc.currency,
			st.name as sip_trunk_name,
			st.host as sip_trunk_host,
			ct.name as callback_trunk_name,
			ct.host as callback_trunk_host
		FROM users u
		LEFT JOIN rate_cards rc ON rc.id = u.rate_card_id
		LEFT JOIN sippeers st ON st.id = u.sip_trunk_id
		LEFT JOIN sippeers ct ON ct.id = u.callback_trunk_id  
		WHERE u.id = ?";
		
		$query = $this->db->query($sql, array($id));
		
		if($query->num_rows() > 0){
			$user = $query->row();
			
			// Get current destination agent info if set
			if($user->destination_route && strpos($user->destination_route, 'trunk/') === 0) {
				$agent_name = str_replace('trunk/', '', $user->destination_route);
				
				$agent_query = $this->db->select('id, name, defaultuser')
									   ->where('name', $agent_name)
									   ->where('telegram_id', $id)
									   ->get('sippeers');
				
				if($agent_query->num_rows() > 0) {
					$agent = $agent_query->row();
					$user->current_destination_agent_id = $agent->id;
					$user->current_destination_agent_name = $agent->name;
					$user->current_destination_agent_extension = $agent->defaultuser;
				}
			}
			
			return $user;
		} else {
			return array();
		}
	}
	
	function getUserByTelegramId($telegram_id){
		$this->db->select('
			u.*,
			rc.name as rate_card_name,
			rc.currency,
			st.name as sip_trunk_name,
			st.host as sip_trunk_host,
			ct.name as callback_trunk_name,
			ct.host as callback_trunk_host
		',FALSE);
        $this->db->from('users as u');
		$this->db->join('rate_cards as rc', 'rc.id = u.rate_card_id', 'left');
		$this->db->join('sippeers as st', 'st.id = u.sip_trunk_id', 'left');
		$this->db->join('sippeers as ct', 'ct.id = u.callback_trunk_id', 'left');
		$this->db->where('u.telegram_id', $telegram_id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return null;
        }	
	}
	
	function addUser($data = array()){
		$dataArray = $data;
		$dataArray['password'] = password_hash($dataArray['password'], PASSWORD_DEFAULT);
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		$dataArray['status'] = 'active';
		$dataArray['balance'] = 0.0000;
		$dataArray['credit_limit'] = isset($dataArray['credit_limit']) ? $dataArray['credit_limit'] : 0.0000;
		$dataArray['approval_status'] = 'pending'; // New users start as pending
		$dataArray['campaign_settings_complete'] = FALSE;
		
		$this->db->insert('users',$dataArray);
		return $this->db->insert_id();
	}
	
	function editUser($data=array(), $id=0){
		$dataArray = $data;
		$dataArray['updated_at'] = date('Y-m-d H:i:s');
		
		// Only update password if provided
		if(!empty($dataArray['password'])){
			$dataArray['password'] = password_hash($dataArray['password'], PASSWORD_DEFAULT);
		} else {
			unset($dataArray['password']);
		}
		unset($dataArray['user_id']);
		unset($dataArray['destination_agent']);
		unset($dataArray['destination_trunk']);
		unset($dataArray['destination_type']);
		// Check if campaign settings are complete
		if(isset($dataArray['sip_trunk_id']) && isset($dataArray['caller_id']) && 
		   isset($dataArray['concurrent_calls']) && $dataArray['sip_trunk_id'] && 
		   $dataArray['caller_id'] && $dataArray['concurrent_calls']){
			$dataArray['campaign_settings_complete'] = TRUE;
		}
		
		$this->db->where('id', $id); 
        $this->db->update('users', $dataArray);
		return true;
	}
	
	function approveUser($user_id, $admin_username = 'admin'){
		$dataArray = array(
			'approval_status' => 'approved',
			'approval_date' => date('Y-m-d H:i:s'),
			'approved_by' => $admin_username,
			'updated_at' => date('Y-m-d H:i:s')
		);
		
		$this->db->where('id', $user_id);
		$this->db->update('users', $dataArray);
		return true;
	}
	
	function rejectUser($user_id, $admin_username = 'admin'){
		$dataArray = array(
			'approval_status' => 'rejected',
			'approval_date' => date('Y-m-d H:i:s'),
			'approved_by' => $admin_username,
			'updated_at' => date('Y-m-d H:i:s')
		);
		
		$this->db->where('id', $user_id);
		$this->db->update('users', $dataArray);
		return true;
	}
	
	function setCampaignSettings($user_id, $settings){
		$dataArray = array(
			'sip_trunk_id' => $settings['sip_trunk_id'],
			'callback_trunk_id' => isset($settings['callback_trunk_id']) ? $settings['callback_trunk_id'] : null,
			'caller_id' => $settings['caller_id'],
			'dial_prefix' => isset($settings['dial_prefix']) ? $settings['dial_prefix'] : '',
			'concurrent_calls' => isset($settings['concurrent_calls']) ? $settings['concurrent_calls'] : 30,
			'campaign_settings_complete' => TRUE,
			'updated_at' => date('Y-m-d H:i:s')
		);
		
		$this->db->where('id', $user_id);
		$this->db->update('users', $dataArray);
		return true;
	}
	
	function getPendingApprovals(){
		$this->db->select('
			u.*,
			rc.name as rate_card_name
		',FALSE);
        $this->db->from('users as u');
		$this->db->join('rate_cards as rc', 'rc.id = u.rate_card_id', 'left');
		$this->db->where('u.approval_status', 'pending');
		$this->db->order_by('u.created_at', 'ASC');
        $query=$this->db->get();
        return $query->result();
	}
	
	function getUsersAwaitingCampaignSettings(){
		$this->db->select('
			u.*,
			rc.name as rate_card_name
		',FALSE);
        $this->db->from('users as u');
		$this->db->join('rate_cards as rc', 'rc.id = u.rate_card_id', 'left');
		$this->db->where('u.approval_status', 'approved');
		$this->db->where('u.campaign_settings_complete', FALSE);
		$this->db->order_by('u.approval_date', 'ASC');
        $query=$this->db->get();
        return $query->result();
	}
	
	function isUserReadyForCampaign($telegram_id){
		$this->db->select('u.*');
        $this->db->from('users as u');
		$this->db->where('u.telegram_id', $telegram_id);
		$this->db->where('u.approval_status', 'approved');
		$this->db->where('u.campaign_settings_complete', TRUE);
		$this->db->where('u.status', 'active');
		$this->db->where('u.rate_card_id IS NOT NULL');
		$this->db->where('u.sip_trunk_id IS NOT NULL');
        $query=$this->db->get();
        return ($query->num_rows() > 0) ? $query->row() : null;
	}
	
	function getUserCampaignData($telegram_id){
		$user = $this->isUserReadyForCampaign($telegram_id);
		if(!$user){
			return null;
		}
		
		// Get complete user data with trunk information
		$this->db->select('
			u.*,
			rc.name as rate_card_name,
			rc.currency,
			st.name as sip_trunk_name,
			st.host as sip_trunk_host,
			st.username as sip_trunk_username,
			st.secret as sip_trunk_secret,
			st.port as sip_trunk_port,
			ct.name as callback_trunk_name,
			ct.host as callback_trunk_host,
			ct.username as callback_trunk_username,
			ct.secret as callback_trunk_secret,
			ct.port as callback_trunk_port
		',FALSE);
        $this->db->from('users as u');
		$this->db->join('rate_cards as rc', 'rc.id = u.rate_card_id', 'left');
		$this->db->join('sippeers as st', 'st.id = u.sip_trunk_id', 'left');
		$this->db->join('sippeers as ct', 'ct.id = u.callback_trunk_id', 'left');
		$this->db->where('u.telegram_id', $telegram_id);
        $query=$this->db->get();
        
        return $query->row();
	}
	
	function deleteUser($data=array()){
		$this->db->where('id',$data['id']); 
        $this->db->delete('users');
		return true;
	}
	
	function updateBalance($user_id, $amount, $operation = 'add'){
		if($operation == 'add'){
			$this->db->set('balance', 'balance + ' . $amount, FALSE);
		} else {
			$this->db->set('balance', 'balance - ' . $amount, FALSE);
		}
		$this->db->where('id', $user_id);
		$this->db->update('users');
		return true;
	}
	
	function addTransaction($data = array()){
		$dataArray = $data;
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		
		// Get current balance
		$this->db->select('balance');
		$this->db->where('id', $dataArray['user_id']);
		$user = $this->db->get('users')->row();
		$dataArray['balance_before'] = $user ? $user->balance : 0;
		
		// Insert transaction
		$this->db->insert('transactions', $dataArray);
		$transaction_id = $this->db->insert_id();
		
		if($transaction_id){
			// Update user balance
			if($dataArray['transaction_type'] == 'credit' || $dataArray['transaction_type'] == 'refund'){
				$this->updateBalance($dataArray['user_id'], $dataArray['amount'], 'add');
			} elseif($dataArray['transaction_type'] == 'debit'){
				$this->updateBalance($dataArray['user_id'], $dataArray['amount'], 'subtract');
			}
			
			// Get new balance
			$this->db->select('balance');
			$this->db->where('id', $dataArray['user_id']);
			$user = $this->db->get('users')->row();
			$new_balance = $user ? $user->balance : 0;
			
			// Update transaction with new balance
			$this->db->where('id', $transaction_id);
			$this->db->update('transactions', array('balance_after' => $new_balance));
		}
		
		return $transaction_id;
	}
	
	function getUserTransactions($user_id, $limit = 50){
		$this->db->select('
			t.*,
			u.username,
			u.first_name,
			u.last_name
		',FALSE);
        $this->db->from('transactions as t');
		$this->db->join('users as u', 'u.id = t.user_id', 'left');
		$this->db->where('t.user_id', $user_id);
		$this->db->order_by('t.created_at', 'DESC');
		$this->db->limit($limit);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function assignRateCard($user_id, $rate_card_id){
		$dataArray = array(
			'rate_card_id' => $rate_card_id,
			'updated_at' => date('Y-m-d H:i:s')
		);
		
		$this->db->where('id', $user_id); 
        $this->db->update('users', $dataArray);
		return true;
	}
	
	function getUserStats(){
		$stats = array();
		
		// Total users
		$stats['total_users'] = $this->db->count_all('users');
		
		// Active users
		$this->db->where('status', 'active');
		$stats['active_users'] = $this->db->count_all_results('users');
		
		// Pending approvals
		$this->db->where('approval_status', 'pending');
		$stats['pending_approvals'] = $this->db->count_all_results('users');
		
		// Users ready for campaigns
		$this->db->where('approval_status', 'approved');
		$this->db->where('campaign_settings_complete', TRUE);
		$this->db->where('status', 'active');
		$stats['campaign_ready'] = $this->db->count_all_results('users');
		
		// Users with balance
		$this->db->where('balance >', 0);
		$stats['users_with_balance'] = $this->db->count_all_results('users');
		
		// Total balance
		$this->db->select_sum('balance');
		$query = $this->db->get('users');
		$stats['total_balance'] = $query->row()->balance ?: 0;
		
		return $stats;
	}
}