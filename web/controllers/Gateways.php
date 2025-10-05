<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Gateways extends MY_Controller {

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
		$this->load->model('gateways_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Gateways';
		$result['menu'] = 'gateways';
		$result['gateways'] = $this->gateways_model->getGateways();
		$this->addAuditLog('gateways','index');
		$this->load->view('gateways/gateways', $result);
	}
	
	public function add(){
		$result['title'] = 'Add Gateway';
		$result['menu'] = 'gateways';
		if($this->input->post()){
			$this->addAuditLog('gateways','add-gateway');
			$result = $this->gateways_model->addGateway($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'Gateway Added Successfully');
				redirect('gateways', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Add Gateway');
				$this->load->view('gateways/add', $result);
			}
		}else{
			$this->load->view('gateways/add', $result);
		}
	}
	
	public function edit($id=0, $error=''){
		$result['title'] = 'Edit Gateways';
		$result['menu'] = 'gateways';
		if($this->input->post()){
			$this->addAuditLog('gateways','edit-gateway');
			$result = $this->gateways_model->editGateway($this->input->post(), $id);
			if($result){
				$this->session->set_flashdata('message', 'Gateway Updated Successfully');
				redirect('gateways', 'refresh');
			}else{
				$result['fields'] = $this->gateways_model->getGateway($id);
				$this->load->view('gateways/edit', $result);
			}
		}else{
			$result['fields'] = $this->gateways_model->getGateway($id);
			$this->load->view('gateways/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete Gateway';
		$result['menu'] = 'gateways';
		if($this->input->post()){
			$this->addAuditLog('gateways','delete-gateway');
			$result = $this->gateways_model->deleteGateway($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'Gateway Deleted Successfully');
				redirect('gateways', 'refresh');
			}
		}else{
			$result['fields'] = $this->gateways_model->getGateway($id);
			$this->load->view('gateways/delete', $result);
		}
	}
}
