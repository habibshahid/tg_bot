<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Lists extends MY_Controller {

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
		$this->load->model('lists_model');
		$this->load->model('moh_model');
		$this->load->model('ivrs_model');
		$this->load->model('gateways_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'Lists';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$this->addAuditLog('fwd-lists','index');
		$this->load->view('lists/lists', $result);
	}
	
	public function add(){
		$result['title'] = 'Add List';
		$result['menu'] = 'lists';
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','add-list');
			$result = $this->lists_model->addList($this->input->post());
			$queue = $this->lists_model->addQueue($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'List Added Successfully');
				redirect('lists', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Add List');
				$this->load->view('lists/add');
			}
		}else{
			$result['mohs'] = $this->moh_model->getMOHs();
			$result['ivrs'] = $this->ivrs_model->getIVRs();
			$result['gateways'] = $this->gateways_model->getGateways();
			$this->load->view('lists/add', $result);
		}
	}
	
	public function edit($id=0, $error=''){
		$result['title'] = 'Edit List';
		$result['menu'] = 'lists';
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','edit-list');
			$result = $this->lists_model->editList($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'List Updated Successfully');
				redirect('lists', 'refresh');
			}else{
				$result['mohs'] = $this->moh_model->getMOHs();
				$result['ivrs'] = $this->ivrs_model->getIVRs();
				$result['fields'] = $this->lists_model->getList($id);
				$result['numbers'] = $this->lists_model->getNumbers($id);
				$result['adminNumbers'] = $this->lists_model->getAdminNumbers($id);
				$result['fwdNumbers'] = $this->lists_model->getFwdNumbers($id);
				$result['gateways'] = $this->gateways_model->getGateways();
				$result['agents'] = $this->lists_model->getAgents();
				$result['queueAgents'] = $this->lists_model->getQueueAgents($result['fields']->list_name);
				$this->load->view('lists/edit', $result);
			}
		}else{
			$result['mohs'] = $this->moh_model->getMOHs();
			$result['ivrs'] = $this->ivrs_model->getIVRs();
			$result['fields'] = $this->lists_model->getList($id);
			$result['numbers'] = $this->lists_model->getNumbers($id);
			$result['adminNumbers'] = $this->lists_model->getAdminNumbers($id);
			$result['fwdNumbers'] = $this->lists_model->getFwdNumbers($id);
			$result['gateways'] = $this->gateways_model->getGateways();
			$result['agents'] = $this->lists_model->getAgents();
			$result['queueAgents'] = $this->lists_model->getQueueAgents($result['fields']->list_name);
			$result['errors'] = $error;
			//echo '<pre>';print_r($result);die;
			$this->load->view('lists/edit', $result);
		}
	}
	
	public function addFwdNumber(){
		$result['title'] = 'Add FWD List Number';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','add-number');
			$result = $this->lists_model->addFwdNumber(array('number' => $this->input->post('fwd_number'), 'list_id' => $this->input->post('fwd_list_id')));
			if($result){
				//$this->viewAgain($this->input->post('fwd_list_id'), '');
				redirect('lists/edit/'.$this->input->post('fwd_list_id'),'refresh');	
			}
		}else{
			$this->viewAgain($this->input->post('list_id'), '');
		}
	}
	
	public function addNumber(){
		$result['title'] = 'Add List Number';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','add-number');
			$result = $this->lists_model->addNumber($this->input->post());
			if($result){
				//$this->viewAgain($this->input->post('list_id'), '');
				redirect('lists/edit/'.$this->input->post('list_id'),'refresh');	
			}
		}else{
			//$this->viewAgain($this->input->post('list_id'), '');
			redirect('lists/edit/'.$this->input->post('list_id'),'refresh');	
		}
	}
	
	public function addAdminNumber(){
		$result['title'] = 'Add Admin Number';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','add-admin-number');
			$result = $this->lists_model->addAdminNumber(
				array(
					'number' => $this->input->post('admin_number'), 
					'list_id' => $this->input->post('admin_list_id'), 
					'sip_trunk' => $this->input->post('sip_trunk')
				)
			);
			if($result){
				//$this->viewAgain($this->input->post('admin_list_id'), '');
				redirect('lists/edit/'.$this->input->post('admin_list_id'),'refresh');	
			}
		}else{
			redirect('lists/edit/'.$this->input->post('admin_list_id'),'refresh');	
		}
	}
	
	public function addAgent($agentId = '', $listId = ''){
		$result['title'] = 'Add Agent';
		$result['menu'] = 'lists';
		$result['fields'] = $this->lists_model->getList($listId);
		$result['agent'] = $this->lists_model->getAgent($agentId);
		$this->addAuditLog('fwd-lists','add-agent');
		$result = $this->lists_model->addAgent($result);
		redirect('lists/edit/'.$listId,'refresh');	
	}
	
	public function deleteAgent($agentId = '', $listId = ''){
		$result['title'] = 'Add Agent';
		$result['menu'] = 'lists';
		$this->addAuditLog('fwd-lists','delete-agent');
		$result['fields'] = $this->lists_model->getList($listId);
		$result = $this->lists_model->deleteAgent($agentId, $result['fields']->list_name);
		redirect('lists/edit/'.$listId,'refresh');	
	}
	
	public function viewAgain($id=0){
		$result['title'] = 'Edit List';
		$result['menu'] = 'lists';
		$result['mohs'] = $this->moh_model->getMOHs();
		$result['fields'] = $this->lists_model->getList($id);
		$result['gateways'] = $this->gateways_model->getGateways();
		$result['numbers'] = $this->lists_model->getNumbers($id);
		$result['adminNumbers'] = $this->lists_model->getAdminNumbers($id);
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		$result['errors'] = '';
		$this->load->view('lists/edit', $result);
	}
	
	public function deleteNumber($id=0){
		$result['title'] = 'Delete List Number';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		$result['gateways'] = $this->gateways_model->getGateways();
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','delete-admin-number');
			$result = $this->lists_model->deleteNumber($this->input->post());
			if($result){
				//$this->viewAgain($this->input->post('list_id'), '');
				redirect('lists/edit/'.$this->input->post('list_id'),'refresh');	
			}
		}else{
			$result['fields'] = $this->lists_model->getNumber($id);
			$this->load->view('lists/deleteNumber', $result);
		}
	}
	
	public function deleteAll($id=0){
		$result['title'] = 'Delete All Numbers';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		$result['gateways'] = $this->gateways_model->getGateways();
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','delete-all-numbers');
			$result = $this->lists_model->deleteAllNumber($this->input->post('list_id'));
			if($result){
				//$this->viewAgain($this->input->post('list_id'), '');
				redirect('lists/edit/'.$this->input->post('list_id'),'refresh');	
			}
		}else{
			$result['fields'] = $this->lists_model->getAllNumbers($id);
			$result['fields']->id = $id;
			
			$this->load->view('lists/deleteAllNumbers', $result);
		}
	}
	
	public function deleteAllAdmin($id=0){
		$result['title'] = 'Delete All Admin Numbers';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		$result['gateways'] = $this->gateways_model->getGateways();
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','delete-all-admin-numbers');
			$result = $this->lists_model->deleteAllAdminNumber($this->input->post('list_id'));
			if($result){
				//$this->viewAgain($this->input->post('list_id'), '');
				redirect('lists/edit/'.$this->input->post('list_id'),'refresh');
			}
		}else{
			$result['fields'] = $this->lists_model->getAllAdminNumbers($id);
			$result['fields']->id = $id;
			$this->load->view('lists/deleteAllAdminNumbers', $result);
		}
	}
	
	public function deleteAdminNumber($id=0){
		$result['title'] = 'Delete Admin Number';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['gateways'] = $this->gateways_model->getGateways();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		//print_r($this->input->post());die;
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','delete-admin-number');
			$result = $this->lists_model->deleteAdminNumber($this->input->post());
			if($result){
				//$this->viewAgain($this->input->post('admin_list_id'), '');
				redirect('lists/edit/'.$this->input->post('admin_list_id'),'refresh');
			}
		}else{
			$result['fields'] = $this->lists_model->getAdminNumber($id);
			$this->load->view('lists/deleteAdminNumber', $result);
		}
	}
	
	public function deleteFwdNumber($id=0){
		$result['title'] = 'Delete FWD Number';
		$result['menu'] = 'lists';
		$result['lists'] = $this->lists_model->getLists();
		$result['gateways'] = $this->gateways_model->getGateways();
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		//print_r($this->input->post());die;
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','delete-fwd-number');
			$result = $this->lists_model->deleteFwdNumber($this->input->post());
			if($result){
				//redirect('lists');
				redirect('lists/edit/'.$this->input->post('list_id'),'refresh');	
			}
		}else{
			$result['fields'] = $this->lists_model->getFwdNumber($id);
			$this->load->view('lists/deleteFwdNumber', $result);
		}
	}
	
	public function delete($id=0){
		$result['title'] = 'Delete List';
		$result['menu'] = 'lists';
		if($this->input->post()){
			$this->addAuditLog('fwd-lists','delete-fwd-list');
			$result = $this->lists_model->deleteList($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'List Deleted Successfully');
				redirect('lists', 'refresh');
			}
		}else{
			$result['fields'] = $this->lists_model->getList($id);
			$this->load->view('lists/delete', $result);
		}
	}
	
	function uploadFile(){
        $this->addAuditLog('uploadFile');
		//echo 'Memory limit: ' . ini_get('memory_limit');die;
        $list_id = $this->input->post('list_id');
        $config['upload_path'] = 'export/';
        $config['allowed_types'] = 'csv|xls|xlsx|txt';
        $config['max_size']	= '1024 * 20';

        $this->load->library('upload', $config);
        $this->upload->initialize($config);

        $this->form_validation->set_rules('userfile', 'File', 'trim|xss_clean');
        if ($this->form_validation->run() == true) {

            if ( ! $this->upload->do_upload()){
                $this->session->set_flashdata('error',$this->upload->display_errors());
                redirect('lists/edit/'.$list_id,'refresh');
            }else{
                $datafile = array('upload_data' => $this->upload->data());
                $array_file = explode('.', $datafile['upload_data']['file_name']);
                $extension  = end($array_file);
                $filename=$datafile['upload_data']['file_name'];
                if('txt' == $extension) {
					$sheet_data = file(FCPATH . 'export/' . $filename, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
					//$numbers = array_map('intval', $file_content);
					
					for($i = 0; $i < count($sheet_data); $i++) {
						$fields = explode(',',$sheet_data[$i]);
						$numbers_array[] = array(
							'number' 	=>  preg_replace('/\D/', '', trim($fields[0])),
							//'email' 	=>  trim($fields[1]),
							'list_id' => $this->input->post('list_id')
						);
					}
					
					$this->lists_model->addNumbers($numbers_array);
					redirect('lists/edit/'.$this->input->post('list_id'),'refresh');
				}
				else{
					if('csv' == $extension) {
						$reader = new \PhpOffice\PhpSpreadsheet\Reader\Csv();
					} else if('xls' == $extension) {
						$reader = new \PhpOffice\PhpSpreadsheet\Reader\Xls();
					} else {
						$reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
					}
					$reader->setReadDataOnly(true);
					$xlspath =FCPATH . 'export/'. $datafile['upload_data']['file_name'];
					$spreadsheet = $reader->load($xlspath);
					$sheet_data  = $spreadsheet->getActiveSheet(0)->toArray();
					//$array_data  = [];

					$labels = array();
					//foreach($sheet_data as $Row){
					for($i = 0; $i < count($sheet_data); $i++) {
						$numbers_array[] = array(
							'number' 	=>  preg_replace('/\D/', '', trim($sheet_data[$i][0])),
							'list_id' => $this->input->post('list_id')
						);
					}
					
					//echo '<pre>';print_r($numbers_array);die;
					$this->lists_model->addNumbers($numbers_array);
					redirect('lists/edit/'.$this->input->post('list_id'),'refresh');
				}
            }
        }
        else{
            $data['message'] = (validation_errors() ? validation_errors() : ($this->ion_auth->errors() ? $this->ion_auth->errors() : $this->session->flashdata('message')));
            $this->session->set_flashdata('error', $data['message']);
            redirect('lists/edit/'.$this->input->post('list_id'),'refresh');
        }
    }
	
	function uploadAdminFile(){
        $this->addAuditLog('uploadAdminFile');

        $list_id = $this->input->post('admin_list_id');
        $config['upload_path'] = 'export/';
        $config['allowed_types'] = 'csv|xls|xlsx|txt';
        $config['max_size']	= '1024 * 20';

        $this->load->library('upload', $config);
        $this->upload->initialize($config);

        $this->form_validation->set_rules('userfile', 'File', 'trim|xss_clean');
        if ($this->form_validation->run() == true) {

            if ( ! $this->upload->do_upload()){
                $this->session->set_flashdata('error',$this->upload->display_errors());
                redirect('lists/edit/'.$list_id,'refresh');
            }else{
                $datafile = array('upload_data' => $this->upload->data());
                $array_file = explode('.', $datafile['upload_data']['file_name']);
                $extension  = end($array_file);
                $filename=$datafile['upload_data']['file_name'];
				if('txt' == $extension) {
					$sheet_data = file(FCPATH . 'export/' . $filename, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
					$numbers = array_map('intval', $file_content);
					for($i = 0; $i < count($sheet_data); $i++) {
						$numbers_array[] = array(
							'number' 	=>  preg_replace('/\D/', '', trim($sheet_data[$i])),
							'list_id' => $list_id
						);
					}
					//print_r($numbers_array);die;
					$this->lists_model->addAdminNumbers($numbers_array);
					redirect('lists/edit/'.$list_id,'refresh');
				}
				else{
					if('csv' == $extension) {
						$reader = new \PhpOffice\PhpSpreadsheet\Reader\Csv();
					} else if('xls' == $extension) {
						$reader = new \PhpOffice\PhpSpreadsheet\Reader\Xls();
					} else {
						$reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
					}

					$xlspath =FCPATH . 'export/'. $datafile['upload_data']['file_name'];
					$spreadsheet = $reader->load($xlspath);
					$sheet_data  = $spreadsheet->getActiveSheet(0)->toArray();
					//$array_data  = [];

					$labels = array();
					//foreach($sheet_data as $Row){
					for($i = 0; $i < count($sheet_data); $i++) {
						$numbers_array[] = array(
							'number' 	=>  preg_replace('/\D/', '', trim($sheet_data[$i][0])),
							'list_id' => $list_id
						);
					}
					
					//echo '<pre>';print_r($numbers_array);die;
					$this->lists_model->addAdminNumbers($numbers_array);
					redirect('lists/edit/'.$list_id,'refresh');
				}
            }
        }
        else{
            $data['message'] = (validation_errors() ? validation_errors() : ($this->ion_auth->errors() ? $this->ion_auth->errors() : $this->session->flashdata('message')));
            $this->session->set_flashdata('error', $data['message']);
            redirect('lists/edit/'.$list_id,'refresh');
        }
    }
}
