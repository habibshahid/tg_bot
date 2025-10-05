<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Home extends MY_Controller {

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
		$this->load->model('dids_model');
		$this->load->model('lists_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
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
	
	public function index()
	{
		$result['title'] = 'Dashboard';
		$result['menu'] = 'dashboard';
		$this->addAuditLog('dashboard','index');
		$socketUrl = explode('/', base_url());
		$result['socket_io_url'] = 'http://' . $socketUrl[2] . ':4241';
		$this->load->view('home', $result);
	}
	
	public function holdCall()
	{
		$this->addAuditLog('dashboard','hold-call');
		$curl_url = 'http://127.0.0.1:4240/webhook';
	
		$ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $curl_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array('event' => 'holdCall', 'channel' => $this->input->post('channel'), 'moh' => $this->input->post('moh'), 'uid' => $this->input->post('uid'))));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('content-type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);
        $output = curl_exec($ch);
        $response = json_decode($output);
        curl_close($ch);
		
		echo json_encode($this->input->post());
	}
	
	public function unholdCall()
	{
		$this->addAuditLog('dashboard','un-hold-call');
		$curl_url = 'http://127.0.0.1:4240/webhook';
	
		$ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $curl_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array('event' => 'unholdCall', 'channel' => $this->input->post('channel'), 'moh' => $this->input->post('moh'), 'uid' => $this->input->post('uid'))));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('content-type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);
        $output = curl_exec($ch);
        $response = json_decode($output);
        curl_close($ch);
		
		echo json_encode($this->input->post());
	}
	
	public function muteAdmin()
	{
		$this->addAuditLog('dashboard','muteAdmin');
		$curl_url = 'http://127.0.0.1:4240/webhook';
	
		$ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $curl_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array('event' => 'muteAdmin', 'channel' => $this->input->post('channel'), 'uid' => $this->input->post('uid'))));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('content-type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);
        $output = curl_exec($ch);
        $response = json_decode($output);
        curl_close($ch);
		
		echo json_encode($this->input->post());
	}
	
	public function unmuteAdmin()
	{
		$this->addAuditLog('dashboard','unmuteAdmin');
		$curl_url = 'http://127.0.0.1:4240/webhook';
	
		$ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $curl_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array('event' => 'unmuteAdmin', 'channel' => $this->input->post('channel'), 'uid' => $this->input->post('uid'))));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('content-type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);
        $output = curl_exec($ch);
        $response = json_decode($output);
        curl_close($ch);
		
		echo json_encode($this->input->post());
	}
	
	public function hangupCall()
	{
		$this->addAuditLog('dashboard','hangup-call');
	
		$this->db->where('id', $this->input->post('id')); 
        $this->db->update('customer_calls', array('callEnd' => date('Y-m-d H:i:s')));
		
		$curl_url = 'http://127.0.0.1:4240/webhook';
		$ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $curl_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array('event' => 'hangupCall', 'channel' => $this->input->post('channel'))));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('content-type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);
        $output = curl_exec($ch);
        $response = json_decode($output);
        curl_close($ch);
		
		echo json_encode($this->input->post());
	}
}
