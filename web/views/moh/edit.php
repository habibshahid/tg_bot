<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">

      <?php $this->load->view('templates/top_nav'); ?>

      <div class="container-fluid">
        <h1 class="mt-4">Add Files to Music on Hold Class</h1>
		<span style="color:red"><?php if(isset($errors) && $errors !== ''){echo ($errors['error']);}?></span>
        <?php $attributes = array('class'=>'form-signin');
		echo form_open("moh/add",$attributes);?>
			<div class="form-group">
				<input class="form-control" id="name" name="name" value="<?php echo $fields->name;?>" readonly />
			</div>
			<hr>
			<h1 class="mt-4">Music on Hold Files <a href="#uploadFile" data-toggle="modal" class="btn btn-sm btn-success float-right">Add New <i class="fa fa-plus"></i></a></h1>
			<table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
				<thead>
					<th>File Name</th>
					<th>Actions</th>
				</thead>
				<tbody>
					<?php foreach ($files as $file){ ?>
					<tr>
						<td>
							<audio controls>
							  <source src="<?php echo base_url() . 'assets/sounds/moh/' . $fields->name . '/' . $file->original_name;?>" type="audio/mpeg">
							  Your browser does not support the audio tag.
							</audio>
							<br>
							<?php echo $file->original_name;?>
						</td>
						<td>
							<a href="<?php echo base_url();?>moh/deleteFile/<?php echo $file->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
						</td>
					</tr>
					<?php } ?>
				</tbody>
			</table>
			<hr>
			<a href="<?php echo base_url();?>moh" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

	<div aria-hidden="true" aria-labelledby="myModalLabel" role="dialog" tabindex="-1" id="uploadFile" class="modal fade">
    	<div class="modal-dialog">
        	<div class="modal-content">
            	<div class="modal-header">
                	<button aria-hidden="true" data-dismiss="modal" class="close" type="button"><i class="fa fa-times"></i></button>
                   	<h4 class="modal-title">Upload Audio File</h4>
                </div>
                <div class="modal-body">
					<?php echo form_open_multipart('moh/upload');?>
						<input type="hidden" id="moh_id" name="moh_id" value="<?php echo $fields->id;?>">
						<input type="hidden" id="moh_name" name="moh_name" value="<?php echo $fields->name;?>">
						<input type='file' name='userfile' size='2000' />
						<input type='submit' class='btn btn-success btn-sm' name='submit' value='upload' />
					</form>
				</div>
			</div>
		</div>
	</div>
  
  <!-- Bootstrap core JavaScript -->
  <?php $this->load->view('templates/footer'); ?>
  <script>
	function closeModal(){
		$('#uploadFile').hide();
	}
	
	$(document).ready(function(){
		$('#cdrs_table').DataTable();
    });
  </script>

</body>

</html>
