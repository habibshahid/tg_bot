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
        <h3 class="mt-4">Delete Gateway</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("gateways/delete",$attributes);?>
			<div class="form-group">
				<span>Are you sure you want to delete <?php echo $fields->name; ?>?</span>
			</div>
			<input type='hidden' id="id" name="id" value="<?php echo $fields->id; ?>" />
			<button type="submit" class="btn btn-danger btn-sm">Delete Gateway</button>
			<a href="<?php echo base_url();?>gateways" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->
  <?php $this->load->view('templates/footer'); ?>

</body>

</html>
