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
        <h3 class="mt-4">Agents <a href="<?php echo base_url();?>agents/add" class="btn btn-success btn-sm float-right"><i class="fa fa-edit"></i> Add New</a></h2>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>Name</th>
				<th>Actions</th>
			</thead>
			<tbody>
				<?php foreach ($agents as $agent){ ?>
				<tr>
					<td><?php echo $agent->name;?></td>
					<td>
						<a href="<?php echo base_url();?>agents/edit/<?php echo $agent->id;?>" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i> Edit</a>
						<a href="<?php echo base_url();?>agents/delete/<?php echo $agent->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
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
