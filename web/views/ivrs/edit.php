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
        <h1 class="mt-4">Add Files to IVR</h1>
		<span style="color:red"><?php if(isset($errors) && $errors !== ''){echo ($errors['error']);}?></span>
		<h3 class="mt-4">IVR Files <a href="#uploadFile" data-toggle="modal" class="btn btn-sm btn-success float-right">Add New <i class="fa fa-plus"></i></a></h3>
		<table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>File Name</th>
				<th>Actions</th>
			</thead>
			<tbody>
				<?php foreach ($files as $file){ ?>
				<tr>
					<td><?php echo $file->original_name;?></td>
					<td>
						<a href="<?php echo base_url();?>ivrs/deleteFile/<?php echo $file->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
					</td>
				</tr>
				<?php } ?>
			</tbody>
		</table>
		<hr>
		<a href="<?php echo base_url();?>ivrs" class="btn btn-warning btn-sm">Cancel</a>
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
					<?php echo form_open_multipart('ivrs/upload');?>
						<input type="hidden" id="ivr_id" name="ivr_id" value="<?php echo $fields->id;?>">
						<input type="hidden" id="ivr_name" name="ivr_name" value="<?php echo $fields->ivr_name;?>">
						<input type='file' name='userfile' size='2000' />
						<input type='submit' class='btn btn-success btn-sm' name='submit' value='upload' />
					</form>
				</div>
			</div>
		</div>
	</div>
  
   <?php $this->load->view('templates/footer'); ?>
  <script>
	$(document).ready(function(){
		$('#cdrs_table').DataTable();
    });
  </script>
</body>

</html>
