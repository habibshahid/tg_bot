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
        <h1 class="mt-4">Add Music on Hold Class</h1>
        <?php $attributes = array('class'=>'form-signin');
		echo form_open("moh/add",$attributes);?>
			<div class="form-group">
				<input class="form-control" id="name" name="name" placeholder="Enter Class Name" required />
			</div>
			<button type="submit" class="btn btn-success btn-sm">Add MOH</button>
			<a href="<?php echo base_url();?>moh" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>

  <script>
	  $('input').on('keypress', function (event) {
		var regex = new RegExp("^[a-zA-Z0-9]+$");
		var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
		if (!regex.test(key)) {
		   event.preventDefault();
		   return false;
		}
	  });
  </script>
</body>

</html>
