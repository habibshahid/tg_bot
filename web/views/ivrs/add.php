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
        <h1 class="mt-4">Add IVR</h1>
        <?php $attributes = array('class'=>'form-signin');
		echo form_open("ivrs/add",$attributes);?>
			<div class="form-group">
				<input class="form-control" id="ivr_name" name="ivr_name" placeholder="Enter IVR Name" required />
			</div>
			<button type="submit" class="btn btn-success btn-sm">Add IVR</button>
			<a href="<?php echo base_url();?>ivrs" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->
  <?php $this->load->view('templates/footer'); ?>

</body>

</html>
