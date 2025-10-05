<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Dids extends MY_Controller {

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
		$this->load->model('ivrs_model');
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
		$result['title'] = 'DIDs';
		$result['menu'] = 'dids';
		$result['dids'] = $this->dids_model->getDIDs();
		$this->addAuditLog('dids','index');
		$this->load->view('dids/dids', $result);
	}
	
	public function add(){
		$result['title'] = 'Add DID';
		$result['menu'] = 'dids';
		if($this->input->post()){
			$this->addAuditLog('dids','add-did');
			$result = $this->dids_model->addDID($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'DID Added Successfully');
				redirect('dids', 'refresh');
			}else{
				$result['lists'] = $this->lists_model->getLists();
				$result['ivrs'] = $this->ivrs_model->getIVRs();
				$this->load->view('dids/add', $result);
			}
		}else{
			$result['lists'] = $this->lists_model->getLists();
			$result['ivrs'] = $this->ivrs_model->getIVRs();
			$this->load->view('dids/add', $result);
		}
	}
	
	public function edit($id=0){
		$result['title'] = 'Edit DID';
		$result['menu'] = 'dids';
		if($this->input->post()){
			$this->addAuditLog('dids','edit-did');
			$result = $this->dids_model->editDID($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'DID Updated Successfully');
				redirect('dids', 'refresh');
			}else{
				$result['lists'] = $this->lists_model->getLists();
				$this->load->view('dids/edit', $result);
			}
		}else{
			$result['fields'] = $this->dids_model->getDID($id);
			$result['lists'] = $this->lists_model->getLists();
			$this->load->view('dids/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete DID';
		$result['menu'] = 'dids';
		if($this->input->post()){
			$this->addAuditLog('dids','delete-did');
			$result = $this->dids_model->deleteDID($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'DID Deleted Successfully');
				redirect('dids', 'refresh');
			}
		}else{
			$result['fields'] = $this->dids_model->getDID($id);
			$this->load->view('dids/delete', $result);
		}
	}
}
