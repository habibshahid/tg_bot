<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Dialer extends MY_Controller {

	/**
	 * Index Page for this controller.
	 *
	 * Maps to the following URL
	 * 		http://example.com/index.php/welcome
	 *	- or -
	 * 		http://example.com/index.php/welcome/index
	 *	- or -
	 * Since this controller is set as the default controller in
	 * config/routes.php, it's displayed at http://example.com/
	 *
	 * So any other public methods not prefixed with an underscore will
	 * map to /index.php/welcome/<method_name>
	 * @see https://codeigniter.com/user_guide/general/urls.html
	 */
	
	function __construct()
	{
		parent::__construct();
		$this->load->driver('Session');
		$this->load->helper('language');
		$this->load->library('upload');
		$this->load->model('lists_model');
		$this->load->model('moh_model');
		$this->load->model('ivrs_model');
		$this->load->model('gateways_model');
		$this->load->model('lists_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Dialer';
		$result['menu'] = 'dialer';
		$result['mohs'] = $this->moh_model->getMOHs();
		$result['lists'] = $this->lists_model->getLists();
		$result['gateways'] = $this->gateways_model->getGateways();
		$this->addAuditLog('dialer','index');
		$this->load->view('dialer', $result);
	}
	
	public function auto()
	{
		$result['title'] = 'Dialer';
		$result['menu'] = 'autoDialer';
		$result['mohs'] = $this->moh_model->getMOHs();
		$result['lists'] = $this->lists_model->getLists();
		$result['gateways'] = $this->gateways_model->getGateways();
		$this->addAuditLog('auto-dialer','index');
		$this->load->view('auto-dialer', $result);
	}
	
	public function start($id = '')
	{
		$result['title'] = 'Dialer';
		$result['menu'] = 'autoDialer';
		$result['mohs'] = $this->moh_model->getMOHs();
		$result['lists'] = $this->lists_model->getLists();
		$this->lists_model->startDialer($id);
		$this->addAuditLog('auto-dialer','index');
		redirect('dialer/auto');
	}
	
	public function stop($id = '')
	{
		$result['title'] = 'Dialer';
		$result['menu'] = 'autoDialer';
		$result['mohs'] = $this->moh_model->getMOHs();
		$result['lists'] = $this->lists_model->getLists();
		$this->lists_model->stopDialer($id);
		$this->addAuditLog('auto-dialer','index');
		redirect('dialer/auto');
	}
	
	public function reset($id = '')
	{
		$result['title'] = 'Dialer';
		$result['menu'] = 'autoDialer';
		$result['mohs'] = $this->moh_model->getMOHs();
		$result['lists'] = $this->lists_model->getLists();
		$this->lists_model->resetDialer($id);
		$this->addAuditLog('auto-dialer','index');
		redirect('dialer/auto');
	}
	
	public function dial(){		
		$callData = array(
			'event' => 'dialCall', 
			'customer' => $this->input->post('customer_number'), 
			'branch' => $this->input->post('branch_number'), 
			'admin' => $this->input->post('admin_number'),
			'moh'	=> $this->input->post('moh_name'),
			'gateway'	=> $this->input->post('gateway'),
			'listid'	=> $this->input->post('listid'),
			'callerid'	=> $this->input->post('callerid')
		);
		
		$this->addAuditLog('dialer','dialNow');
		
		$curl_url = 'http://127.0.0.1:4240/webhook';
		
		$ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $curl_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($callData));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('content-type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);
        $output = curl_exec($ch);
        $response = json_decode($output);
        curl_close($ch);
		
		$this->session->set_flashdata('message', 'Call Dialed');
		redirect('dialer', 'refresh');
	}
	
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
}
