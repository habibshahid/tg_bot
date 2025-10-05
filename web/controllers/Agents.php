<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Agents extends MY_Controller {

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
		$this->load->model('agents_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Agents';
		$result['menu'] = 'agents';
		$result['agents'] = $this->agents_model->getAgents();
		$this->addAuditLog('agents','index');
		$this->load->view('agents/agents', $result);
	}
	
	public function add(){
		$result['title'] = 'Add Agent';
		$result['menu'] = 'agents';
		if($this->input->post()){
			$this->addAuditLog('agents','add-agent');
			$result = $this->agents_model->addAgent($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'Agent Added Successfully');
				redirect('agents', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Add Agent');
				$this->load->view('agents/add', $result);
			}
		}else{
			$this->load->view('agents/add', $result);
		}
	}
	
	public function edit($id=0, $error=''){
		$result['title'] = 'Edit Agents';
		$result['menu'] = 'agents';
		if($this->input->post()){
			$this->addAuditLog('agents','edit-agent');
			$result = $this->agents_model->editAgent($this->input->post(), $id);
			if($result){
				$this->session->set_flashdata('message', 'Agent Updated Successfully');
				redirect('agents', 'refresh');
			}else{
				$result['fields'] = $this->agents_model->getAgent($id);
				$this->load->view('agents/edit', $result);
			}
		}else{
			$result['fields'] = $this->agents_model->getAgent($id);
			$this->load->view('agents/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete Agent';
		$result['menu'] = 'agents';
		if($this->input->post()){
			$this->addAuditLog('agents','delete-agent');
			$result = $this->agents_model->deleteAgent($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'Agent Deleted Successfully');
				redirect('agents', 'refresh');
			}
		}else{
			$result['fields'] = $this->agents_model->getAgent($id);
			$this->load->view('agents/delete', $result);
		}
	}
}
