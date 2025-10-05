<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Ivrs extends MY_Controller {

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
		$this->load->model('ivrs_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'IVRs';
		$result['menu'] = 'ivrs';
		$result['ivrs'] = $this->ivrs_model->getIVRs();
		$this->addAuditLog('ivrs','index');
		$this->load->view('ivrs/ivrs', $result);
	}
	
	public function add(){
		$result['title'] = 'Add IVR';
		$result['menu'] = 'ivrs';
		if($this->input->post()){
			$this->addAuditLog('ivrs','add-ivr');
			$result = $this->ivrs_model->addIVR($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'IVR Added Successfully');
				redirect('ivrs', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Add IVR');
				$this->load->view('ivrs/add');
			}
		}else{
			$this->load->view('ivrs/add');
		}
	}
	
	public function edit($id=0, $error=''){
		$result['title'] = 'Edit IVR';
		$result['menu'] = 'ivrs';
		$result['fields'] = $this->ivrs_model->getIVR($id);
		$result['files'] = $this->ivrs_model->getFiles($id);
		$result['errors'] = $error;
		$this->addAuditLog('ivrs','edit-ivr');
		$this->load->view('ivrs/edit', $result);
	}
	
			
	public function upload(){
		$this->load->helper(array('form', 'url'));
		
		// Get IVR name and validate
		$ivr_name = $this->input->post('ivr_name');
		if(empty($ivr_name)){
			$error = array('error' => 'IVR name is required');
			$this->edit($this->input->post('ivr_id'), $error);
			return;
		}
		
		// Create temporary upload directory
		$temp_dir = sys_get_temp_dir() . '/ivr_uploads_' . uniqid() . '/';
		if(!mkdir($temp_dir, 0777, true)){
			$error = array('error' => 'Failed to create temporary directory');
			$this->edit($this->input->post('ivr_id'), $error);
			return;
		}
		
		// Final destination directory
		$final_dir = FCPATH."assets/sounds/ivrs/".$ivr_name.'/';
		
		$this->addAuditLog('ivrs','ivr-file-upload');
		
		// Upload to temporary directory first
		$config = array(
			'upload_path' => $temp_dir,
			'allowed_types' => "wav|mp3",
			'overwrite' => TRUE,
			'max_size' => 50000,
		);
		$this->upload->initialize($config);
		
		if($this->upload->do_upload()){
			$upload_data = $this->upload->data();
			$file_name = $upload_data['file_name'];
			$file_info = pathinfo($file_name);
			$file = $file_info['filename'];
			$extension = $file_info['extension'];
			
			// Paths in temp directory
			$temp_original_file = $upload_data['full_path'];
			$temp_converted_file = $temp_dir . $file . '_converted.wav';
			
			// FFmpeg command to convert to 16-bit, 8000 Hz, mono WAV
			$ffmpeg_command = sprintf(
				'ffmpeg -i %s -acodec pcm_s16le -ar 8000 -ac 1 -y %s 2>&1',
				escapeshellarg($temp_original_file),
				escapeshellarg($temp_converted_file)
			);
			
			// Execute ffmpeg command
			exec($ffmpeg_command, $output, $return_var);
			
			if($return_var === 0){
				// Conversion successful
				
				// Create final directory if it doesn't exist
				if(!is_dir($final_dir)){
					if(!mkdir($final_dir, 0777, true)){
						// Clean up temp files
						$this->cleanup_temp_dir($temp_dir);
						$error = array('error' => 'Failed to create IVR directory: ' . $final_dir);
						$this->edit($this->input->post('ivr_id'), $error);
						return;
					}
					
					// Set permissions and ownership
					chmod($final_dir, 0777);
					$chown_cmd = sprintf('chown -R www-data:www-data %s', escapeshellarg($final_dir));
					exec($chown_cmd);
				}
				
				// Final file path
				$final_file_name = $file . '.wav';
				$final_file_path = $final_dir . $final_file_name;
				
				// Move converted file to final destination
				if(rename($temp_converted_file, $final_file_path)){
					// Set permissions on final file
					chmod($final_file_path, 0777);
					$file_chown_cmd = sprintf('chown www-data:www-data %s', escapeshellarg($final_file_path));
					exec($file_chown_cmd);
					
					// Clean up temp directory
					$this->cleanup_temp_dir($temp_dir);
					
					// Update file information
					$fileData = array(
						'ivr_id'        => $this->input->post('ivr_id'),
						'filename'      => $file,
						'filepath'      => $final_dir . $file,
						'extension'     => 'wav',
						'original_name' => $file_name,
						'saved_name'    => $final_file_name
					);
					$this->ivrs_model->addFile($fileData);
					
					$data = array('upload_data' => $this->upload->data());
					$this->edit($this->input->post('ivr_id'), '');
				}else{
					// Failed to move file
					$this->cleanup_temp_dir($temp_dir);
					$error = array('error' => 'Failed to move converted file to destination');
					$this->edit($this->input->post('ivr_id'), $error);
				}
			}else{
				// FFmpeg conversion failed
				$this->cleanup_temp_dir($temp_dir);
				$error = array('error' => 'Audio conversion failed: ' . implode("\n", $output));
				$this->edit($this->input->post('ivr_id'), $error);
			}
		}else{
			// Upload failed
			$this->cleanup_temp_dir($temp_dir);
			$error = array('error' => $this->upload->display_errors());
			$this->edit($this->input->post('ivr_id'), $error);
		}
	}

	// Helper function to clean up temporary directory
	private function cleanup_temp_dir($dir){
		if(is_dir($dir)){
			$files = glob($dir . '*');
			foreach($files as $file){
				if(is_file($file)){
					unlink($file);
				}
			}
			rmdir($dir);
		}
	}

	
	public function delete($id=0){
		$result['title'] = 'Delete IVR';
		$result['menu'] = 'ivrs';
		if($this->input->post()){
			$this->addAuditLog('ivrs','delete-ivr');
			$result = $this->ivrs_model->deleteIVR($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'IVR Deleted Successfully');
				redirect('ivrs', 'refresh');
			}
		}else{
			$result['fields'] = $this->ivrs_model->getIVR($id);
			$this->load->view('ivrs/delete', $result);
		}
	}
	
	public function deleteFile($id=0){
		$result['title'] = 'Delete IVR File';
		$result['menu'] = 'ivrs';
		if($this->input->post()){
			$this->addAuditLog('ivrs','delete-ivr-file');
			$result = $this->ivrs_model->deleteFile($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'IVR File Deleted Successfully');
				$this->edit($result, '');
			}
		}else{
			$result['fields'] = $this->ivrs_model->getFile($id);
			$this->load->view('ivrs/deleteFile', $result);
		}
	}
}
