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
        <h1 class="mt-4">Delete Number</h1>
		<span style="color:red"><?php if(isset($errors) && $errors !== ''){echo ($errors['error']);}?></span>
        <?php $attributes = array('class'=>'form-signin');
		echo form_open("lists/deleteAdminNumber",$attributes);?>
			<div class="form-group">
				<span>Are you sure you want to delete <?php echo $fields->number; ?>?</span>
			</div>
			<input type='hidden' id="id" name="id" value="<?php echo $fields->id; ?>" />
			<input type='hidden' id="list_id" name="list_id" value="<?php echo $fields->list_id; ?>" />
			<button type="submit" class="btn btn-danger btn-sm">Delete Number</button>
			<a href="<?php echo base_url();?>lists/edit/<?php echo $fields->list_id;?>" class="btn btn-warning btn-sm">Cancel</a>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->
  
  <?php $this->load->view('templates/footer'); ?>

</body>

</html>
