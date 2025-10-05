<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Providers extends MY_Controller {

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
		$this->load->model('providers_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Providers Management';
		$result['menu'] = 'providers';
		$result['providers'] = $this->providers_model->getProviders();
		$result['stats'] = $this->providers_model->getProviderStats();
		$this->addAuditLog('providers','index');
		$this->load->view('providers/providers', $result);
	}
	
	public function add(){
		$result['title'] = 'Add Provider';
		$result['menu'] = 'providers';
		
		if($this->input->post()){
			$this->addAuditLog('providers','add-provider');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('name', 'Provider Name', 'required|is_unique[providers.name]');
			$this->form_validation->set_rules('currency', 'Currency', 'required|exact_length[3]');
			$this->form_validation->set_rules('billing_increment', 'Billing Increment', 'required|integer|greater_than[0]');
			$this->form_validation->set_rules('minimum_duration', 'Minimum Duration', 'required|integer|greater_than_equal_to[0]');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$this->load->view('providers/add', $result);
			} else {
				$result_id = $this->providers_model->addProvider($this->input->post());
				if($result_id){
					$this->session->set_flashdata('message', 'Provider Added Successfully');
					redirect('providers', 'refresh');
				}else{
					$this->session->set_flashdata('message', 'Unable to Add Provider');
					$this->load->view('providers/add', $result);
				}
			}
		}else{
			$this->load->view('providers/add', $result);
		}
	}
	
	public function edit($id=0){
		$result['title'] = 'Edit Provider';
		$result['menu'] = 'providers';
		
		if($this->input->post()){
			$this->addAuditLog('providers','edit-provider');
			
			// Validation
			$this->load->library('form_validation');
			$this->form_validation->set_rules('name', 'Provider Name', 'required');
			$this->form_validation->set_rules('currency', 'Currency', 'required|exact_length[3]');
			$this->form_validation->set_rules('billing_increment', 'Billing Increment', 'required|integer|greater_than[0]');
			$this->form_validation->set_rules('minimum_duration', 'Minimum Duration', 'required|integer|greater_than_equal_to[0]');
			
			if ($this->form_validation->run() == FALSE) {
				$this->session->set_flashdata('message', validation_errors());
				$result['fields'] = $this->providers_model->getProvider($id);
				$this->load->view('providers/edit', $result);
			} else {
				$result_update = $this->providers_model->editProvider($this->input->post(), $id);
				if($result_update){
					$this->session->set_flashdata('message', 'Provider Updated Successfully');
					redirect('providers', 'refresh');
				}else{
					$result['fields'] = $this->providers_model->getProvider($id);
					$this->load->view('providers/edit', $result);
				}
			}
		}else{
			$result['fields'] = $this->providers_model->getProvider($id);
			$this->load->view('providers/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete Provider';
		$result['menu'] = 'providers';
		if($this->input->post()){
			$this->addAuditLog('providers','delete-provider');
			$result_delete = $this->providers_model->deleteProvider($this->input->post());
			if($result_delete['success']){
				$this->session->set_flashdata('message', 'Provider Deleted Successfully');
				redirect('providers', 'refresh');
			}else{
				$this->session->set_flashdata('message', $result_delete['error']);
				redirect('providers', 'refresh');
			}
		}else{
			$result['fields'] = $this->providers_model->getProvider($id);
			$result['rate_cards'] = $this->providers_model->getProviderRateCards($id);
			$this->db->where('provider_id', $id);
			$result['rate_cards_count'] = $this->db->count_all_results('rate_cards');
			$this->load->view('providers/delete', $result);
		}
	}
	
	public function view($id=0){
		$result['title'] = 'Provider Details';
		$result['menu'] = 'providers';
		$result['provider'] = $this->providers_model->getProvider($id);
		
		if(empty($result['provider'])){
			$this->session->set_flashdata('message', 'Provider not found');
			redirect('providers', 'refresh');
		}
		
		$result['rate_cards'] = $this->providers_model->getProviderRateCards($id);
		$result['stats'] = $this->providers_model->getProviderStats($id);
		
		// Get performance data for last 30 days
		$start_date = date('Y-m-d', strtotime('-30 days'));
		$end_date = date('Y-m-d');
		$result['performance'] = $this->providers_model->getProviderPerformance($id, $start_date, $end_date);
		$result['top_destinations'] = $this->providers_model->getTopDestinations($id, 10);
		
		$this->addAuditLog('providers','view-provider');
		$this->load->view('providers/view', $result);
	}
	
	public function search(){
		$result['title'] = 'Search Providers';
		$result['menu'] = 'providers';
		
		$search_term = $this->input->get('search');
		if($search_term){
			$result['providers'] = $this->providers_model->searchProviders($search_term);
			$result['search_term'] = $search_term;
		}else{
			$result['providers'] = array();
			$result['search_term'] = '';
		}
		
		$this->addAuditLog('providers','search');
		$this->load->view('providers/search', $result);
	}
	
	public function performance_report($id=0){
		$result['title'] = 'Provider Performance Report';
		$result['menu'] = 'providers';
		$result['provider'] = $this->providers_model->getProvider($id);
		
		if(empty($result['provider'])){
			$this->session->set_flashdata('message', 'Provider not found');
			redirect('providers', 'refresh');
		}
		
		// Get date range from input or default to last 30 days
		$start_date = $this->input->get('start_date') ?: date('Y-m-d', strtotime('-30 days'));
		$end_date = $this->input->get('end_date') ?: date('Y-m-d');
		
		$result['start_date'] = $start_date;
		$result['end_date'] = $end_date;
		$result['performance'] = $this->providers_model->getProviderPerformance($id, $start_date, $end_date);
		$result['daily_volume'] = $this->providers_model->getDailyCallVolume($id, $start_date, $end_date);
		$result['top_destinations'] = $this->providers_model->getTopDestinations($id, 15);
		
		$this->addAuditLog('providers','performance-report');
		$this->load->view('providers/performance_report', $result);
	}
	
	public function export_performance($id=0){
		$provider = $this->providers_model->getProvider($id);
		
		if(!$provider){
			$this->session->set_flashdata('message', 'Provider not found');
			redirect('providers', 'refresh');
			return;
		}
		
		$start_date = $this->input->get('start_date') ?: date('Y-m-d', strtotime('-30 days'));
		$end_date = $this->input->get('end_date') ?: date('Y-m-d');
		
		$performance = $this->providers_model->getProviderPerformance($id, $start_date, $end_date);
		$daily_volume = $this->providers_model->getDailyCallVolume($id, $start_date, $end_date);
		
		// Set headers for CSV download
		header('Content-Type: text/csv');
		header('Content-Disposition: attachment; filename="provider_performance_' . $provider->name . '_' . date('Y-m-d') . '.csv"');
		
		$output = fopen('php://output', 'w');
		
		// CSV header
		fputcsv($output, array('Provider Performance Report'));
		fputcsv($output, array('Provider', $provider->name));
		fputcsv($output, array('Period', $start_date . ' to ' . $end_date));
		fputcsv($output, array(''));
		
		// Performance summary
		fputcsv($output, array('Metric', 'Value'));
		fputcsv($output, array('Total Calls', $performance['total_calls']));
		fputcsv($output, array('Answered Calls', $performance['answered_calls']));
		fputcsv($output, array('Success Rate', $performance['success_rate'] . '%'));
		fputcsv($output, array('Total Revenue', '$' . number_format($performance['total_revenue'], 2)));
		fputcsv($output, array('Total Duration (minutes)', round($performance['total_duration'] / 60, 2)));
		fputcsv($output, array('Average Rate', '$' . number_format($performance['avg_rate'], 4)));
		fputcsv($output, array(''));
		
		// Daily volume data
		fputcsv($output, array('Daily Call Volume'));
		fputcsv($output, array('Date', 'Total Calls', 'Answered Calls', 'Revenue'));
		foreach($daily_volume as $day){
			fputcsv($output, array(
				$day->call_date,
				$day->total_calls,
				$day->answered_calls,
				'$' . number_format($day->total_revenue, 2)
			));
		}
		
		fclose($output);
		exit;
	}
}