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
        <h3 class="mt-4">Auto Dialer</h3>
        <table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>List Name</th>
				<th>MOH</th>
				<th>IVR</th>
				<th>Actions</th>
			</thead>
			<tbody>
				<?php foreach ($lists as $list){ ?>
				<tr>
					<td><?php echo $list->list_name;?></td>
					<td><?php echo $list->moh_name;?></td>
					<td><?php echo $list->ivr_name;?></td>
					<td>
						<a href="<?php echo base_url();?>dialer/reset/<?php echo $list->id;?>" class="btn btn-warning btn-sm"><i class="fa fa-times"></i> Reset Numbers</a>
						<?php if($list->status == 0){ ?>
						<a href="<?php echo base_url();?>dialer/start/<?php echo $list->id;?>" class="btn btn-success btn-sm"><i class="fa fa-edit"></i> Start</a>
						<?php } else { ?>
						<a href="<?php echo base_url();?>dialer/stop/<?php echo $list->id;?>" class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Stop</a>
						<?php } ?>
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
