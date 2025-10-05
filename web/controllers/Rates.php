<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Rates extends MY_Controller {

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
		$this->load->model('rates_model');
		$this->load->model('rate_cards_model');
		$this->load->model('destinations_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Rates Management';
		$result['menu'] = 'rates';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		
		// Filter by rate card if selected
		$rate_card_id = $this->input->get('rate_card_id');
		$result['selected_rate_card'] = $rate_card_id;
		$result['rates'] = $this->rates_model->getRates($rate_card_id);
		
		$this->addAuditLog('rates','index');
		$this->load->view('rates/rates', $result);
	}
	
	public function add(){
		$result['title'] = 'Add Rate';
		$result['menu'] = 'rates';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		$result['destinations'] = $this->destinations_model->getDestinations();
		
		if($this->input->post()){
			$this->addAuditLog('rates','add-rate');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('rate_card_id', 'Rate Card', 'required');
			$this->form_validation->set_rules('destination_id', 'Destination', 'required');
			$this->form_validation->set_rules('cost_price', 'Cost Price', 'required|decimal');
			$this->form_validation->set_rules('selling_price', 'Selling Price', 'decimal');
			$this->form_validation->set_rules('billing_increment', 'Billing Increment', 'required|integer');
			$this->form_validation->set_rules('minimum_duration', 'Minimum Duration', 'required|integer');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$this->load->view('rates/add', $result);
			} else {
				$result_id = $this->rates_model->addRate($this->input->post());
				if($result_id){
					$this->session->set_flashdata('message', 'Rate Added Successfully');
					redirect('rates', 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Unable to Add Rate');
					$this->load->view('rates/add', $result);
				}
			}
		}else{
			$this->load->view('rates/add', $result);
		}
	}
	
	public function edit($id=0){
		$result['title'] = 'Edit Rate';
		$result['menu'] = 'rates';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		$result['destinations'] = $this->destinations_model->getDestinations();
		
		if($this->input->post()){
			$this->addAuditLog('rates','edit-rate');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('rate_card_id', 'Rate Card', 'required');
			$this->form_validation->set_rules('destination_id', 'Destination', 'required');
			$this->form_validation->set_rules('cost_price', 'Cost Price', 'required|decimal');
			$this->form_validation->set_rules('sell_price', 'Selling Price', 'required|decimal');
			$this->form_validation->set_rules('billing_increment', 'Billing Increment', 'required|integer');
			$this->form_validation->set_rules('minimum_duration', 'Minimum Duration', 'required|integer');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$result['fields'] = $this->rates_model->getRate($id);
				$this->load->view('rates/edit', $result);
			} else {
				$result_update = $this->rates_model->editRate($this->input->post(), $id);
				if($result_update){
					$this->session->set_flashdata('message', 'Rate Updated Successfully');
					redirect('rates', 'refresh');
				}else{
					$result['fields'] = $this->rates_model->getRate($id);
					$this->load->view('rates/edit', $result);
				}
			}
		}else{
			$result['fields'] = $this->rates_model->getRate($id);
			$this->load->view('rates/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete Rate';
		$result['menu'] = 'rates';
		if($this->input->post()){
			$this->addAuditLog('rates','delete-rate');
			$result_delete = $this->rates_model->deleteRate($this->input->post());
			if($result_delete){
				$this->session->set_flashdata('message', 'Rate Deleted Successfully');
				redirect('rates', 'refresh');
			}
		}else{
			$result['fields'] = $this->rates_model->getRate($id);
			$this->load->view('rates/delete', $result);
		}
	}
	
	public function bulk_upload(){
		$result['title'] = 'Bulk Upload Rates';
		$result['menu'] = 'rates';
		$result['rate_cards'] = $this->rate_cards_model->getRateCards();
		
		if($this->input->post()){
			$this->addAuditLog('rates','bulk-upload');
			
			// File upload configuration
			$config['upload_path'] = './uploads/rates/';
			$config['allowed_types'] = 'csv';
			$config['max_size'] = 2048; // 2MB
			$config['file_name'] = 'rates_' . time();
			
			if (!is_dir($config['upload_path'])) {
				mkdir($config['upload_path'], 0755, true);
			}
			
			$this->upload->initialize($config);
			
			if ($this->upload->do_upload('csv_file')) {
				$file_data = $this->upload->data();
				$file_path = $file_data['full_path'];
				
				$result_import = $this->rates_model->importRatesFromCSV($file_path, $this->input->post('rate_card_id'));
				
				if($result_import['success']){
					$this->session->set_flashdata('message', 'Rates imported successfully. ' . $result_import['imported'] . ' rates added.');
					unlink($file_path); // Delete uploaded file
					redirect('rates', 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Error importing rates: ' . $result_import['error']);
					unlink($file_path); // Delete uploaded file
				}
			} else {
				$this->session->set_flashdata('message', $this->upload->display_errors());
			}
		}
		
		$this->load->view('rates/bulk_upload', $result);
	}
	
	public function export_rates(){
		$rate_card_id = $this->input->get('rate_card_id');
		
		if(!$rate_card_id){
			$this->session->set_flashdata('message', 'Please select a rate card to export');
			redirect('rates', 'refresh');
			return;
		}
		
		$rates = $this->rates_model->getRatesForExport($rate_card_id);
		$rate_card = $this->rate_cards_model->getRateCard($rate_card_id);
		
		// Set headers for CSV download
		header('Content-Type: text/csv');
		header('Content-Disposition: attachment; filename="rates_' . $rate_card->name . '_' . date('Y-m-d') . '.csv"');
		
		$output = fopen('php://output', 'w');
		
		// CSV header
		fputcsv($output, array('Destination Code', 'Destination Name', 'Rate', 'Connect Fee', 'Increment', 'Minimum Duration'));
		
		// CSV data
		foreach($rates as $rate){
			fputcsv($output, array(
				$rate->destination_code,
				$rate->destination_name,
				$rate->rate,
				$rate->connect_fee,
				$rate->increment,
				$rate->minimum_duration
			));
		}
		
		fclose($output);
		exit;
	}
}