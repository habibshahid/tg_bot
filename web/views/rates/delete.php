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
        <h3 class="mt-4">Delete Rate - <?php echo $fields->destination_name; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rates">Rates</a></li>
				<li class="breadcrumb-item active">Delete Rate</li>
			</ol>
		</nav>
		
		<div class="alert alert-danger" role="alert">
			<h4 class="alert-heading">Warning!</h4>
			<p>You are about to permanently delete this rate. This action cannot be undone.</p>
			<hr>
			<p class="mb-0">This may affect call pricing for existing users assigned to this rate card.</p>
		</div>
		
		<!-- Rate Information Card -->
		<div class="card mb-4">
			<div class="card-header bg-danger text-white">
				<h5>Rate Information to be Deleted</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-6">
						<table class="table table-borderless">
							<tr>
								<td><strong>Destination Code:</strong></td>
								<td><span class="badge badge-primary badge-lg"><?php echo $fields->destination_code; ?></span></td>
							</tr>
							<tr>
								<td><strong>Destination Name:</strong></td>
								<td><?php echo $fields->destination_name; ?></td>
							</tr>
							<tr>
								<td><strong>Country:</strong></td>
								<td><?php echo $fields->country ?: 'N/A'; ?></td>
							</tr>
							<tr>
								<td><strong>Region:</strong></td>
								<td><?php echo $fields->region ?: 'N/A'; ?></td>
							</tr>
							<tr>
								<td><strong>Rate Card:</strong></td>
								<td>
									<span class="badge badge-info">
										<?php echo $fields->rate_card_name . ' (' . $fields->currency . ')'; ?>
									</span>
								</td>
							</tr>
						</table>
					</div>
					<div class="col-md-6">
						<table class="table table-borderless">
							<tr>
								<td><strong>Cost per Minute:</strong></td>
								<td>
									<span class="badge badge-success badge-lg">
										$<?php echo number_format($fields->cost_price, 4); ?>
									</span>
								</td>
							</tr>
							<tr>
								<td><strong>Selling per Minute:</strong></td>
								<td>$<?php echo number_format($fields->sell_price, 4); ?></td>
							</tr>
							<tr>
								<td><strong>Billing Increment:</strong></td>
								<td><?php echo $fields->billing_increment; ?> seconds</td>
							</tr>
							<tr>
								<td><strong>Minimum Duration:</strong></td>
								<td><?php echo $fields->minimum_duration; ?> seconds</td>
							</tr>
							<tr>
								<td><strong>Effective Date:</strong></td>
								<td><?php echo date('Y-m-d', strtotime($fields->effective_from)); ?></td>
							</tr>
							<?php if($fields->effective_to): ?>
							<tr>
								<td><strong>Expiry Date:</strong></td>
								<td><?php echo date('Y-m-d', strtotime($fields->effective_to)); ?></td>
							</tr>
							<?php endif; ?>
						</table>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Impact Analysis Card -->
		<div class="card mb-4">
			<div class="card-header bg-warning text-dark">
				<h5>Deletion Impact Analysis</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-12">
						<h6>The following will be affected:</h6>
						<ul class="list-group list-group-flush">
							<li class="list-group-item d-flex justify-content-between align-items-center">
								Future Calls to <?php echo $fields->destination_name; ?>
								<span class="badge badge-warning badge-pill">No rate will be available</span>
							</li>
							<li class="list-group-item d-flex justify-content-between align-items-center">
								Rate Card: <?php echo $fields->rate_card_name; ?>
								<span class="badge badge-info badge-pill">One less destination rate</span>
							</li>
							<li class="list-group-item d-flex justify-content-between align-items-center">
								Call Routing
								<span class="badge badge-danger badge-pill">Calls may fail or use default rates</span>
							</li>
						</ul>
						
						<div class="alert alert-warning mt-3">
							<strong>Important:</strong> After deleting this rate, calls to destination code 
							<strong><?php echo $fields->destination_code; ?></strong> using rate card 
							<strong><?php echo $fields->rate_card_name; ?></strong> will not have a defined rate.
						</div>
						
						<div class="alert alert-info mt-3">
							<strong>Note:</strong> This action only deletes the rate. The destination 
							<strong><?php echo $fields->destination_name; ?></strong> will remain available 
							for other rate cards.
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Rate Calculation Examples -->
		<div class="card mb-4">
			<div class="card-header bg-info text-white">
				<h5>Current Rate Examples (Will Be Lost)</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-12">
						<h6>Example call costs with current rate:</h6>
						<div class="table-responsive">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Call Duration</th>
										<th>Billable Duration</th>
										<th>Rate Cost</th>
										<th>Selling Price</th>
									</tr>
								</thead>
								<tbody>
									<?php 
									$examples = array(30, 60, 120, 300, 600); // 30s, 1m, 2m, 5m, 10m
									foreach($examples as $duration):
										$billable = max($duration, $fields->minimum_duration);
										$units = ceil($billable / $fields->billing_increment);
										$actual_billable = $units * $fields->billing_increment;
										$rate_cost = ($fields->cost_price * $actual_billable) / 60;
										$total_cost = $rate_cost + $fields->sell_price;
									?>
									<tr>
										<td><?php echo $duration; ?>s</td>
										<td><?php echo $actual_billable; ?>s</td>
										<td>$<?php echo number_format($rate_cost, 4); ?></td>
										<td>$<?php echo number_format($fields->sell_price, 4); ?></td>
									</tr>
									<?php endforeach; ?>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Confirmation Form -->
		<div class="card mb-4">
			<div class="card-header bg-dark text-white">
				<h5>Deletion Confirmation</h5>
			</div>
			<div class="card-body">
				<?php $attributes = array('class'=>'form-delete', 'onsubmit'=>'return confirmDelete()');
				echo form_open("rates/delete/".$fields->id,$attributes);?>
				<input type="hidden" name="id" value="<?php echo $fields->id; ?>">
				
				<div class="row">
					<div class="col-md-12">
						<button type="submit" class="btn btn-danger btn-sm" id="deleteBtn">
							<i class="fa fa-trash"></i> Permanently Delete Rate
						</button>
						<a href="<?php echo base_url();?>rates" class="btn btn-secondary btn-sm">Cancel</a>
						<a href="<?php echo base_url();?>rates/edit/<?php echo $fields->id; ?>" class="btn btn-warning btn-sm">Edit Instead</a>
					</div>
				</div>
				<?php echo form_close();?>
			</div>
		</div>
		
		<!-- Alternative Actions -->
		<div class="card mb-4">
			<div class="card-header bg-info text-white">
				<h5>Alternative Actions</h5>
			</div>
			<div class="card-body">
				<p>Instead of deleting this rate, you might consider:</p>
				<div class="row">
					<div class="col-md-4">
						<a href="<?php echo base_url();?>rates/edit/<?php echo $fields->id; ?>" class="btn btn-warning btn-block">
							<i class="fa fa-edit"></i> Modify Rate
						</a>
						<small class="text-muted">Update the pricing instead</small>
					</div>
					<div class="col-md-4">
						<button class="btn btn-info btn-block" onclick="setExpiryDate()">
							<i class="fa fa-clock-o"></i> Set Expiry Date
						</button>
						<small class="text-muted">Schedule rate to expire</small>
					</div>
					<div class="col-md-4">
						<a href="<?php echo base_url();?>rates/add" class="btn btn-success btn-block">
							<i class="fa fa-plus"></i> Add New Rate
						</a>
						<small class="text-muted">Create a replacement rate</small>
					</div>
				</div>
			</div>
		</div>
		
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function(){
		// Enable delete button only when confirmation is typed correctly
		$('#confirmation').keyup(function(){
			var confirmation = $(this).val();
			var checkbox = $('#understand_warning').is(':checked');
			
			if(confirmation === 'DELETE' && checkbox){
				$('#deleteBtn').prop('disabled', false);
				$('#deleteBtn').removeClass('btn-secondary').addClass('btn-danger');
			} else {
				$('#deleteBtn').prop('disabled', true);
				$('#deleteBtn').removeClass('btn-danger').addClass('btn-secondary');
			}
		});
		
		$('#understand_warning').change(function(){
			var confirmation = $('#confirmation').val();
			var checkbox = $(this).is(':checked');
			
			if(confirmation === 'DELETE' && checkbox){
				$('#deleteBtn').prop('disabled', false);
				$('#deleteBtn').removeClass('btn-secondary').addClass('btn-danger');
			} else {
				$('#deleteBtn').prop('disabled', true);
				$('#deleteBtn').removeClass('btn-danger').addClass('btn-secondary');
			}
		});
	});
	
	function confirmDelete(){
		var confirmation = $('#confirmation').val();
		if(confirmation !== 'DELETE'){
			alert('Please type "DELETE" in the confirmation field to proceed.');
			return false;
		}
		
		var destination = '<?php echo $fields->destination_name; ?>';
		var rate = '<?php echo number_format($fields->rate, 4); ?>';
		
		var message = 'Are you absolutely sure you want to delete the rate for "' + destination + '"?\n\n';
		message += 'Current Rate:  + rate + ' per minute\n\n';
		message += 'This action CANNOT be undone!\n\n';
		message += 'Future calls to this destination may fail or use incorrect rates.\n\n';
		message += 'Click OK to proceed with deletion.';
		
		return confirm(message);
	}
	
	function setExpiryDate(){
		var today = new Date();
		var futureDate = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
		var dateString = futureDate.toISOString().split('T')[0];
		
		if(confirm('Do you want to set this rate to expire on ' + dateString + ' instead of deleting it immediately?\n\nThis will allow existing calls to complete normally while preventing new calls after the expiry date.')){
			window.location.href = '<?php echo base_url(); ?>rates/edit/<?php echo $fields->id; ?>?set_expiry=' + dateString;
		}
	}
  </script>

</body>

</html>