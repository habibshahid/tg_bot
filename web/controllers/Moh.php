<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Moh extends MY_Controller {

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
		$this->load->model('moh_model');
		$this->load->model('audit_model');
		//$this->output->enable_profiler("TRUE");
	}
	
	public function index()
	{
		$result['title'] = 'MOH';
		$result['menu'] = 'moh';
		$result['mohs'] = $this->moh_model->getMOHs();
		$this->addAuditLog('moh','index');
		$this->load->view('moh/moh', $result);
	}
	
	public function add(){
		$result['title'] = 'Add MOH';
		$result['menu'] = 'moh';
		if($this->input->post()){
			$this->addAuditLog('moh','add-moh');
			$result = $this->moh_model->addMOH($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'DID Added Successfully');
				redirect('moh', 'refresh');
			}else{
				$this->session->set_flashdata('message', 'Unable to Add MOH');
				$this->load->view('moh/add');
			}
		}else{
			$this->load->view('moh/add');
		}
	}
	
	public function edit($id=0, $error=''){
		$this->addAuditLog('moh','edit-moh');
		$result['title'] = 'Edit MOH';
		$result['menu'] = 'moh';
		$result['fields'] = $this->moh_model->getMOH($id);
		$result['files'] = $this->moh_model->getFiles($id);
		$result['errors'] = $error;
		$this->load->view('moh/edit', $result);
	}
	
	public function upload(){
    $this->load->helper(array('form', 'url'));
    
    // Get MOH name and validate
    $moh_name = $this->input->post('moh_name');
    $moh_id = $this->input->post('moh_id');
    
    if(empty($moh_name) || empty($moh_id)){
        $error = array('error' => 'MOH name and ID are required');
        $this->edit($moh_id, $error);
        return;
    }
    
    // Sanitize MOH name for directory naming
    $moh_name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $moh_name);
    
    // Create unique temporary directory
    $temp_dir = sys_get_temp_dir() . '/moh_upload_' . $moh_id . '_' . uniqid() . '/';
    
    try {
        // Create temp directory
        if(!mkdir($temp_dir, 0777, true)){
            throw new Exception('Failed to create temporary directory');
        }
        
        // Final destination directory
        $final_dir = FCPATH."assets/sounds/moh/".$moh_name.'/';
        
        $this->addAuditLog('moh','upload-moh-file');
        
        // Upload to temporary directory
        $config = array(
            'upload_path' => $temp_dir,
            'allowed_types' => "wav|mp3|ogg|m4a|aac",
            'overwrite' => TRUE,
            'max_size' => 50000,
            'file_name' => $this->clean_filename($_FILES['userfile']['name'])
        );
        $this->upload->initialize($config);
        
        if(!$this->upload->do_upload()){
            throw new Exception($this->upload->display_errors('', ''));
        }
        
        $upload_data = $this->upload->data();
        $file_info = pathinfo($upload_data['file_name']);
        $file = $file_info['filename'];
        
        // Paths
        $temp_original_file = $upload_data['full_path'];
        $temp_converted_file = $temp_dir . $file . '.wav';
        
        // FFmpeg conversion
        $ffmpeg_command = sprintf(
            'ffmpeg -i %s -acodec pcm_s16le -ar 8000 -ac 1 -f wav -y %s 2>&1',
            escapeshellarg($temp_original_file),
            escapeshellarg($temp_converted_file)
        );
        
        exec($ffmpeg_command, $output, $return_var);
        
        if($return_var !== 0){
            throw new Exception('Audio conversion failed: ' . implode(" ", $output));
        }
        
        // Verify converted file exists and has size
        if(!file_exists($temp_converted_file) || filesize($temp_converted_file) == 0){
            throw new Exception('Conversion produced invalid file');
        }
        
        // Create final directory structure
        if(!is_dir($final_dir)){
            if(!mkdir($final_dir, 0777, true)){
                throw new Exception('Failed to create MOH directory');
            }
            
            // Set directory permissions
            chmod($final_dir, 0777);
            
            // Set ownership (may fail if not running as root)
            $chown_cmd = sprintf('chown -R www-data:www-data %s 2>&1', escapeshellarg(dirname($final_dir)));
            exec($chown_cmd, $chown_output, $chown_return);
            
            if($chown_return !== 0){
                log_message('warning', 'Failed to set directory ownership: ' . implode(" ", $chown_output));
            }
        }
        
        // Final file path
        $final_file_name = $file . '.wav';
        $final_file_path = $final_dir . $final_file_name;
        
        // Move file to final destination
        if(!rename($temp_converted_file, $final_file_path)){
            throw new Exception('Failed to move file to final destination');
        }
        
        // Set file permissions
        chmod($final_file_path, 0666);
        $file_chown_cmd = sprintf('chown www-data:www-data %s 2>&1', escapeshellarg($final_file_path));
        exec($file_chown_cmd);
        
        // Save to database
        $fileData = array(
            'moh_id'        => $moh_id,
            'filename'      => $file,
            'filepath'      => $final_dir . $file,
            'extension'     => 'wav',
            'original_name' => $upload_data['client_name'],
            'saved_name'    => $final_file_name,
            'file_size'     => filesize($final_file_path),
            'upload_date'   => date('Y-m-d H:i:s')
        );
        $this->moh_model->addFile($fileData);
        
        // Success - clean up and redirect
        $this->cleanup_temp_dir($temp_dir);
        $this->edit($moh_id, '');
        
    } catch (Exception $e) {
        // Clean up on any error
        $this->cleanup_temp_dir($temp_dir);
        $error = array('error' => $e->getMessage());
        $this->edit($moh_id, $error);
    }
}

// Helper function to clean up temporary directory
private function cleanup_temp_dir($dir){
    if(is_dir($dir)){
        $files = array_diff(scandir($dir), array('.', '..'));
        foreach($files as $file){
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->cleanup_temp_dir($path) : unlink($path);
        }
        rmdir($dir);
    }
}

// Helper function to clean filename
private function clean_filename($filename){
    $info = pathinfo($filename);
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $info['filename']);
    return $name . '.' . $info['extension'];
}	

	public function delete($id=0){
		$result['title'] = 'Delete MOH';
		$result['menu'] = 'moh';
		if($this->input->post()){
			$this->addAuditLog('moh','delete-moh');
			$result = $this->moh_model->deleteMOH($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'MOH Deleted Successfully');
				redirect('moh', 'refresh');
			}
		}else{
			$result['fields'] = $this->moh_model->getMOH($id);
			$this->load->view('moh/delete', $result);
		}
	}
	
	public function deleteFile($id=0){
		$result['title'] = 'Delete MOH File';
		$result['menu'] = 'moh';
		if($this->input->post()){
			$this->addAuditLog('moh','delete-moh-file');
			$result = $this->moh_model->deleteFile($this->input->post());
			if($result){
				$this->session->set_flashdata('message', 'MOH File Deleted Successfully');
				$this->edit($result, '');
			}
		}else{
			$result['fields'] = $this->moh_model->getFile($id);
			$this->load->view('moh/deleteFile', $result);
		}
	}
}
