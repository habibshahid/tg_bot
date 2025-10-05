<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Users extends MY_Controller {

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
		$this->load->model('users_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Users';
		$result['menu'] = 'users';
		$result['users'] = $this->users_model->getUsers();
		$this->addAuditLog('users','index');
		$this->load->view('users/users', $result);
	}
	
	public function add(){
		$result['title'] = 'Add User';
		$result['menu'] = 'users';
		if($this->input->post()){
			$this->addAuditLog('users','add-user');
			$result = $this->users_model->addUser($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'User Added Successfully');
				redirect('users', 'refresh');
			}else{
				$result['lists'] = $this->lists_model->getLists();
				$this->load->view('users/add', $result);
			}
		}else{
			$this->load->view('users/add', $result);
		}
	}
	
	public function edit($id=0){
		$result['title'] = 'Edit User';
		$result['menu'] = 'users';
		if($this->input->post()){
			$this->addAuditLog('users','edit-user');
			$result = $this->users_model->editUser($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'User Updated Successfully');
				redirect('users', 'refresh');
			}else{
				$this->load->view('users/edit', $result);
			}
		}else{
			$result['fields'] = $this->users_model->getUser($id);
			$this->load->view('users/edit', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete User';
		$result['menu'] = 'users';
		if($this->input->post()){
			$this->addAuditLog('users','delete-user');
			$result = $this->users_model->deleteUser($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'User Deleted Successfully');
				redirect('users', 'refresh');
			}
		}else{
			$result['fields'] = $this->users_model->getUser($id);
			$this->load->view('users/delete', $result);
		}
	}
}
