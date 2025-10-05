<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Rate_cards extends MY_Controller {

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
		$this->load->model('rate_cards_model');
		$this->load->model('providers_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Rate Cards Management';
		$result['menu'] = 'rate_cards';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		$this->addAuditLog('rate_cards','index');
		$this->load->view('rate_cards/rate_cards', $result);
	}
	
	public function add(){
		$result['title'] = 'Add Rate Card';
		$result['menu'] = 'rate_cards';
		$result['providers'] = $this->providers_model->getProviders();
		
		if($this->input->post()){
			$this->addAuditLog('rate_cards','add-rate-card');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('name', 'Name', 'required|is_unique[rate_cards.name]');
			$this->form_validation->set_rules('provider_id', 'Provider', 'required');
			$this->form_validation->set_rules('currency', 'Currency', 'required|exact_length[3]');
			$this->form_validation->set_rules('effective_from', 'Effective Date', 'required');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$this->load->view('rate_cards/add', $result);
			} else {
				$result_id = $this->rate_cards_model->addRateCard($this->input->post());
				if($result_id){
					$this->session->set_flashdata('message', 'Rate Card Added Successfully');
					redirect('rate_cards', 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Unable to Add Rate Card');
					$this->load->view('rate_cards/add', $result);
				}
			}
		}else{
			$this->load->view('rate_cards/add', $result);
		}
	}
	
	public function edit($id=0){
		$result['title'] = 'Edit Rate Card';
		$result['menu'] = 'rate_cards';
		$result['providers'] = $this->providers_model->getProviders();
		
		if($this->input->post()){
			$this->addAuditLog('rate_cards','edit-rate-card');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('name', 'Name', 'required');
			$this->form_validation->set_rules('provider_id', 'Provider', 'required');
			$this->form_validation->set_rules('currency', 'Currency', 'required|exact_length[3]');
			$this->form_validation->set_rules('effective_from', 'Effective Date', 'required');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$result['fields'] = $this->rate_cards_model->getRateCard($id);
				$this->load->view('rate_cards/edit', $result);
			} else {
				$result_update = $this->rate_cards_model->editRateCard($this->input->post(), $id);
				if($result_update){
					$this->session->set_flashdata('message', 'Rate Card Updated Successfully');
					redirect('rate_cards', 'refresh');
				}else{
					$result['fields'] = $this->rate_cards_model->getRateCard($id);
					$this->load->view('rate_cards/edit', $result);
				}
			}
		}else{
			$result['fields'] = $this->rate_cards_model->getRateCard($id);
			$this->load->view('rate_cards/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete Rate Card';
		$result['menu'] = 'rate_cards';
		if($this->input->post()){
			$this->addAuditLog('rate_cards','delete-rate-card');
			
			// Check if rate card is assigned to any users
			$users_count = $this->rate_cards_model->getUsersWithRateCard($id);
			if($users_count > 0){
				$this->session->set_flashdata('message', 'Cannot delete rate card. It is assigned to ' . $users_count . ' user(s).');
				redirect('rate_cards', 'refresh');
			}
			
			$result_delete = $this->rate_cards_model->deleteRateCard($this->input->post());
			if($result_delete){
				$this->session->set_flashdata('message', 'Rate Card Deleted Successfully');
				redirect('rate_cards', 'refresh');
			}
		}else{
			$result['fields'] = $this->rate_cards_model->getRateCard($id);
			$result['users_count'] = $this->rate_cards_model->getUsersWithRateCard($id);
			$this->load->view('rate_cards/delete', $result);
		}
	}
	
	public function view($id=0){
		$result['title'] = 'Rate Card Details';
		$result['menu'] = 'rate_cards';
		$result['rate_card'] = $this->rate_cards_model->getRateCard($id);
		
		if(empty($result['rate_card'])){
			$this->session->set_flashdata('message', 'Rate Card not found');
			redirect('rate_cards', 'refresh');
		}
		
		$result['rates'] = $this->rate_cards_model->getRateCardRates($id);
		$result['users'] = $this->rate_cards_model->getRateCardUsers($id);
		$result['stats'] = $this->rate_cards_model->getRateCardStats($id);
		
		$this->addAuditLog('rate_cards','view-rate-card');
		$this->load->view('rate_cards/view', $result);
	}
	
	public function clone_rate_card($id=0){
		$result['title'] = 'Clone Rate Card';
		$result['menu'] = 'rate_cards';
		$result['providers'] = $this->providers_model->getProviders();
		$result['source_rate_card'] = $this->rate_cards_model->getRateCard($id);
		
		if(empty($result['source_rate_card'])){
			$this->session->set_flashdata('message', 'Source Rate Card not found');
			redirect('rate_cards', 'refresh');
		}
		
		if($this->input->post()){
			$this->addAuditLog('rate_cards','clone-rate-card');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('name', 'Name', 'required|is_unique[rate_cards.name]');
			$this->form_validation->set_rules('provider_id', 'Provider', 'required');
			$this->form_validation->set_rules('currency', 'Currency', 'required|exact_length[3]');
			$this->form_validation->set_rules('effective_from', 'Effective Date', 'required');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$this->load->view('rate_cards/clone', $result);
			} else {
				$result_id = $this->rate_cards_model->cloneRateCard($id, $this->input->post());
				if($result_id){
					$this->session->set_flashdata('message', 'Rate Card Cloned Successfully');
					redirect('rate_cards/view/' . $result_id, 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Unable to Clone Rate Card');
					$this->load->view('rate_cards/clone', $result);
				}
			}
		}else{
			$this->load->view('rate_cards/clone', $result);
		}
	}
	
	public function bulk_update_rates($id=0){
		$result['title'] = 'Bulk Update Rates';
		$result['menu'] = 'rate_cards';
		$result['rate_card'] = $this->rate_cards_model->getRateCard($id);
		
		if(empty($result['rate_card'])){
			$this->session->set_flashdata('message', 'Rate Card not found');
			redirect('rate_cards', 'refresh');
		}
		
		if($this->input->post()){
			$this->addAuditLog('rate_cards','bulk-update-rates');
			
			$update_type = $this->input->post('update_type');
			$value = $this->input->post('value');
			$destinations = $this->input->post('destinations');
			
			if(empty($destinations)){
				$this->session->set_flashdata('message', 'Please select at least one destination');
				$result['rates'] = $this->rate_cards_model->getRateCardRates($id);
				$this->load->view('rate_cards/bulk_update_rates', $result);
				return;
			}
			
			$result_update = $this->rate_cards_model->bulkUpdateRates($id, $update_type, $value, $destinations);
			if($result_update){
				$this->session->set_flashdata('message', 'Rates Updated Successfully');
				redirect('rate_cards/view/' . $id, 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Update Rates');
			}
		}
		
		$result['rates'] = $this->rate_cards_model->getRateCardRates($id);
		$this->load->view('rate_cards/bulk_update_rates', $result);
	}
}