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
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("cdrs/export",$attributes);?>
        <h3 class="mt-4"><table border="0" width="100%"><tr><td>Call Detail Reports</td><td align="right"><button class="btn btn-success btn-sm">Export</button></td></td></table></h3>
		<?php echo form_close();?>
        <table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>Call Date</th>
				<th>DID</th>
				<th>Customer</th>
				<th>Branch</th>
				<th>Admin</th>
				<th>DTMF</th>
				<th>Duration</th>
				<th>Recording</th>
				<!--<th>IVR</th>
				<th>List</th>-->
			</thead>
			<tbody>
				<?php foreach ($cdrs as $cdr){ ?>
				<tr>
					<td><?php echo $cdr->createdAt;?></td>
					<td><?php echo $cdr->did;?></td>
					<td><?php echo $cdr->callerId;?></td>
					<td><?php echo $cdr->branchNumber;?></td>
					<td><?php echo $cdr->adminNumber;?></td>
					<td><?php echo $cdr->dtmf;?></td>
					<td><?php echo gmdate('H:i:s', $cdr->billedSeconds);?></td>
					<td>
						<audio controls>
						  <source src="<?php echo base_url() . 'assets/sounds/monitor/' . $cdr->recordingFile;?>" type="audio/mpeg">
						  Your browser does not support the audio tag.
						</audio>
					</td>
					<!--<td><?php //echo $cdr->ivr_name;?></td>
					<td><?php //echo $cdr->list_name;?></td>-->
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
