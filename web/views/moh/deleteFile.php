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
        <h1 class="mt-4">Delete Music on Hold File</h1>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("moh/deleteFile",$attributes);?>
			<div class="form-group">
				<span>Are you sure you want to delete Music File "<?php echo $fields->filename; ?>" ?</span>
			</div>
			<input type='hidden' id="id" name="id" value="<?php echo $fields->id; ?>" />
			<button type="submit" class="btn btn-danger btn-sm">Delete File</button>
			<a href="<?php echo base_url();?>moh/edit/<?php echo $fields->mod_id;?>" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->
  
  <?php $this->load->view('templates/footer'); ?>
  <script>
	function closeModal(){
		$('#uploadFile').hide();
	}
  </script>

</body>

</html>
