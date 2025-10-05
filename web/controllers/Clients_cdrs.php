<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Clients_cdrs extends MY_Controller {

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
		$this->load->model('clients_clients_cdrs_model');
		$this->load->model('clients_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Call Detail Reports';
		$result['menu'] = 'cdrs';
		
		// Get filter parameters
		$filters = array(
			'start_date' => $this->input->get('start_date') ?: date('Y-m-d', strtotime('-7 days')),
			'end_date' => $this->input->get('end_date') ?: date('Y-m-d'),
			'user_id' => $this->input->get('user_id'),
			'destination' => $this->input->get('destination'),
			'status' => $this->input->get('status')
		);
		
		$result['filters'] = $filters;
		$result['users'] = $this->clients_model->getUsers();
		$result['cdrs'] = $this->clients_cdrs_model->getCdrs($filters);
		$result['stats'] = $this->clients_cdrs_model->getCdrStats($filters);
		
		$this->addAuditLog('cdrs','index');
		$this->load->view('cdrs/cdrs', $result);
	}
	
	public function view($id=0){
		$result['title'] = 'Call Detail';
		$result['menu'] = 'cdrs';
		$result['cdr'] = $this->clients_cdrs_model->getCdr($id);
		
		if(empty($result['cdr'])){
			$this->session->set_flashdata('message', 'Call detail not found');
			redirect('cdrs', 'refresh');
		}
		
		$this->addAuditLog('cdrs','view-cdr');
		$this->load->view('cdrs/view', $result);
	}
	
	public function export(){
		$filters = array(
			'start_date' => $this->input->get('start_date') ?: date('Y-m-d', strtotime('-7 days')),
			'end_date' => $this->input->get('end_date') ?: date('Y-m-d'),
			'user_id' => $this->input->get('user_id'),
			'destination' => $this->input->get('destination'),
			'status' => $this->input->get('status')
		);
		
		$cdrs = $this->clients_cdrs_model->getCdrsForExport($filters);
		
		// Set headers for CSV download
		header('Content-Type: text/csv');
		header('Content-Disposition: attachment; filename="cdr_report_' . date('Y-m-d_H-i-s') . '.csv"');
		
		$output = fopen('php://output', 'w');
		
		// CSV header
		fputcsv($output, array(
			'Call Date',
			'User',
			'Caller ID',
			'Destination',
			'Duration (sec)',
			'Billable Duration (sec)',
			'Rate',
			'Cost',
			'Status',
			'Hangup Cause'
		));
		
		// CSV data
		foreach($cdrs as $cdr){
			fputcsv($output, array(
				$cdr->call_date,
				$cdr->username,
				$cdr->caller_id,
				$cdr->destination,
				$cdr->duration,
				$cdr->billable_duration,
				$cdr->rate,
				$cdr->cost,
				$cdr->status,
				$cdr->hangup_cause
			));
		}
		
		fclose($output);
		exit;
	}
	
	public function dashboard(){
		$result['title'] = 'Call Analytics Dashboard';
		$result['menu'] = 'cdrs';
		
		// Get date range filter
		$days = $this->input->get('days') ?: 7;
		$start_date = date('Y-m-d', strtotime("-{$days} days"));
		$end_date = date('Y-m-d');
		
		$result['days'] = $days;
		$result['dashboard_data'] = $this->clients_cdrs_model->getDashboardData($start_date, $end_date);
		
		$this->addAuditLog('cdrs','dashboard');
		$this->load->view('cdrs/dashboard', $result);
	}
	
	public function user_report($user_id=0){
		$result['title'] = 'User Call Report';
		$result['menu'] = 'cdrs';
		
		if(!$user_id){
			$this->session->set_flashdata('message', 'Invalid user ID');
			redirect('cdrs', 'refresh');
		}
		
		$result['user'] = $this->clients_model->getUser($user_id);
		if(empty($result['user'])){
			$this->session->set_flashdata('message', 'User not found');
			redirect('cdrs', 'refresh');
		}
		
		// Get date range filter
		$filters = array(
			'start_date' => $this->input->get('start_date') ?: date('Y-m-d', strtotime('-30 days')),
			'end_date' => $this->input->get('end_date') ?: date('Y-m-d'),
			'user_id' => $user_id
		);
		
		$result['filters'] = $filters;
		$result['cdrs'] = $this->clients_cdrs_model->getCdrs($filters);
		$result['user_stats'] = $this->clients_cdrs_model->getUserStats($user_id, $filters['start_date'], $filters['end_date']);
		
		$this->addAuditLog('cdrs','user-report');
		$this->load->view('cdrs/user_report', $result);
	}
	
	public function destination_report(){
		$result['title'] = 'Destination Report';
		$result['menu'] = 'cdrs';
		
		// Get date range filter
		$filters = array(
			'start_date' => $this->input->get('start_date') ?: date('Y-m-d', strtotime('-30 days')),
			'end_date' => $this->input->get('end_date') ?: date('Y-m-d')
		);
		
		$result['filters'] = $filters;
		$result['destination_stats'] = $this->clients_cdrs_model->getDestinationStats($filters['start_date'], $filters['end_date']);
		
		$this->addAuditLog('cdrs','destination-report');
		$this->load->view('cdrs/destination_report', $result);
	}
	
	public function hourly_report(){
		$result['title'] = 'Hourly Call Report';
		$result['menu'] = 'cdrs';
		
		$date = $this->input->get('date') ?: date('Y-m-d');
		$result['date'] = $date;
		$result['hourly_stats'] = $this->clients_cdrs_model->getHourlyStats($date);
		
		$this->addAuditLog('cdrs','hourly-report');
		$this->load->view('cdrs/hourly_report', $result);
	}
}