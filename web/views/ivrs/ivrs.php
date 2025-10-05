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
        <h3 class="mt-4">IVRs <a href="<?php echo base_url();?>ivrs/add" class="btn btn-success btn-sm float-right"><i class="fa fa-edit"></i> Add New</a></h3>
        <table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>IVR Name</th>
				<th>Actions</th>
			</thead>
			<tbody>
				<?php foreach ($ivrs as $ivr){ ?>
				<tr>
					<td><?php echo $ivr->ivr_name;?></td>
					<td>
						<a href="<?php echo base_url();?>ivrs/edit/<?php echo $ivr->id;?>" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i> Edit</a>
						<a href="<?php echo base_url();?>ivrs/delete/<?php echo $ivr->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
					</td>
				</tr>
				<?php } ?>
			</tbody>
		</table>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>

  <script>
	  $(document).ready(function(){
		$('#cdrs_table').DataTable();
	  });
  </script>
</body>

</html>
