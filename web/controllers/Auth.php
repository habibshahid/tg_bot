<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Auth extends CI_Controller {

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
		$this->load->model('auth_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$this->load->view('auth/index');
	}
	
	public function login(){
		if($this->input->post('login') !== '' && $this->input->post('password')){
			$result = $this->auth_model->login($this->input->post());
			if($result){
				redirect('home', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Username or Password is Invalid, please try again');
				redirect('auth', 'refresh');	
			}
		}else{
			$this->session->set_flashdata('message', 'Username or Password is not set');
			redirect('auth', 'refresh');
		}
	}
	
	public function logout(){
		$this->session->sess_destroy();
		$this->session->set_flashdata('message', 'Logged Out');
		redirect('auth', 'refresh');
	}
}
