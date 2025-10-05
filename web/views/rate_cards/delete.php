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
        <h3 class="mt-4">Delete Rate Card - <?php echo $fields->name; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards">Rate Cards</a></li>
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards/view/<?php echo $fields->id; ?>"><?php echo $fields->name; ?></a></li>
				<li class="breadcrumb-item active">Delete</li>
			</ol>
		</nav>
		
		<div class="alert alert-danger" role="alert">
			<h4 class="alert-heading">Critical Warning!</h4>
			<p>You are about to permanently delete this rate card and all associated data. This action cannot be undone.</p>
			<hr>
			<p class="mb-0">This will affect all users assigned to this rate card and delete all associated rates.</p>
		</div>
		
		<!-- Rate Card Information Card -->
		<div class="card mb-4">
			<div class="card-header bg-danger text-white">
				<h5>Rate Card Information to be Deleted</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-6">
						<table class="table table-borderless">
							<tr>
								<td><strong>Name:</strong></td>
								<td><span class="badge badge-primary badge-lg"><?php echo $fields->name; ?></span></td>
							</tr>
							<tr>
								<td><strong>Provider:</strong></td>
								<td>
									<?php if($fields->provider_name): ?>
										<span class="badge badge-secondary"><?php echo $fields->provider_name; ?></span>
									<?php else: ?>
										<span class="text-muted">No Provider</span>
									<?php endif; ?>
								</td>
							</tr>
							<tr>
								<td><strong>Currency:</strong></td>
								<td><span class="badge badge-info"><?php echo $fields->currency; ?></span></td>
							</tr>
							<tr>
								<td><strong>Status:</strong></td>
								<td>
									<span class="badge badge-<?php 
										switch($fields->status) {
											case 'active': echo 'success'; break;
											case 'inactive': echo 'secondary'; break;
											case 'draft': echo 'warning'; break;
											default: echo 'secondary';
										}
									?>">
										<?php echo ucfirst($fields->status);?>
									</span>
								</td>
							</tr>
						</table>
					</div>
					<div class="col-md-6">
						<table class="table table-borderless">
							<tr>
								<td><strong>Created:</strong></td>
								<td><?php echo date('Y-m-d H:i:s', strtotime($fields->created_at)); ?></td>
							</tr>
							<tr>
								<td><strong>Last Updated:</strong></td>
								<td><?php echo date('Y-m-d H:i:s', strtotime($fields->updated_at)); ?></td>
							</tr>
							<tr>
								<td><strong>Effective Date:</strong></td>
								<td><?php echo date('Y-m-d', strtotime($fields->effective_from)); ?></td>
							</tr>
							<tr>
								<td><strong>Expiry Date:</strong></td>
								<td><?php echo $fields->effective_to ? date('Y-m-d', strtotime($fields->effective_to)) : 'Never expires'; ?></td>
							</tr>
						</table>
					</div>
				</div>
				
				<?php if($fields->description): ?>
				<div class="row mt-3">
					<div class="col-md-12">
						<strong>Description:</strong>
						<p class="text-muted"><?php echo $fields->description; ?></p>
					</div>
				</div>
				<?php endif; ?>
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
						<h6>The following data will be permanently deleted:</h6>
						<ul class="list-group list-group-flush">
							<li class="list-group-item d-flex justify-content-between align-items-center">
								<div>
									<strong>Rate Card:</strong> <?php echo $fields->name; ?>
									<br><small class="text-muted">The rate card itself and all its settings</small>
								</div>
								<span class="badge badge-danger badge-pill">1 record</span>
							</li>
							
							<li class="list-group-item d-flex justify-content-between align-items-center">
								<div>
									<strong>Call Detail Records:</strong> Historical call records reference
									<br><small class="text-muted">CDR records will reference a deleted rate card</small>
								</div>
								<span class="badge badge-warning badge-pill">Historical data affected</span>
							</li>
						</ul>
					</div>
				</div>
				
				<!-- Critical Warnings -->
				
				
				<?php if($fields->status == 'active'): ?>
				<div class="alert alert-danger mt-3">
					<strong><i class="fa fa-bolt"></i> Active Rate Card:</strong> 
					This is an <strong>active</strong> rate card. Deleting it may immediately affect billing for assigned users.
				</div>
				<?php endif; ?>
			</div>
		</div>
		
		<!-- Statistics Summary -->
		<div class="card mb-4">
			<div class="card-header bg-info text-white">
				<h5>Rate Card Statistics Summary</h5>
			</div>
			<div class="card-body">
				<div class="row">
					
					<div class="col-md-3">
						<div class="card bg-secondary text-white">
							<div class="card-body text-center">
								<h4>0</h4>
								<p>Total Calls</p>
								<small>Historical data</small>
							</div>
						</div>
					</div>
					<div class="col-md-3">
						<div class="card bg-dark text-white">
							<div class="card-body text-center">
								<h4>$0.00</h4>
								<p>Total Revenue</p>
								<small>Historical data</small>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Affected Users List -->
		<?php if($users_count > 0): ?>
		<div class="card mb-4">
			<div class="card-header bg-danger text-white">
				<h5>Users That Will Be Affected</h5>
			</div>
			<div class="card-body">
				<div class="alert alert-danger">
					<strong>Important:</strong> The following <?php echo $users_count; ?> user(s) are currently assigned to this rate card and will be affected by its deletion:
				</div>
				
				<div class="row">
					<div class="col-md-12">
						<p><strong>Recommended Actions Before Deletion:</strong></p>
						<ol>
							<li>Assign affected users to a different rate card</li>
							<li>Or create a replacement rate card first</li>
							<li>Or suspend the users temporarily</li>
						</ol>
						
						<p class="text-danger">
							<strong>Warning:</strong> Users without a rate card assignment may be unable to make calls or may be charged incorrect rates.
						</p>
					</div>
				</div>
			</div>
		</div>
		<?php endif; ?>
		
		
		
		<!-- Confirmation Form -->
		<div class="card mb-4">
			<div class="card-header bg-dark text-white">
				<h5>Final Deletion Confirmation</h5>
			</div>
			<div class="card-body">
				<?php $attributes = array('class'=>'form-delete', 'onsubmit'=>'return confirmDelete()');
				echo form_open("rate_cards/delete/".$fields->id,$attributes);?>
				<input type="hidden" name="id" value="<?php echo $fields->id; ?>">
				
				
				
				<div class="form-group">
					<label for="deletion_reason">Reason for Deletion (Required):</label>
					<textarea class="form-control" id="deletion_reason" name="deletion_reason" rows="3" placeholder="Please provide a detailed reason for deleting this rate card..." required></textarea>
				</div>
				
				<hr>
				<div class="row">
					<div class="col-md-12">
						<button type="submit" class="btn btn-danger btn-sm" id="deleteBtn" >
							<i class="fa fa-trash"></i> Permanently Delete Rate Card and All Data
						</button>
						<a href="<?php echo base_url();?>rate_cards/view/<?php echo $fields->id; ?>" class="btn btn-secondary btn-sm">Cancel</a>
						<a href="<?php echo base_url();?>rate_cards/edit/<?php echo $fields->id; ?>" class="btn btn-warning btn-sm">Edit Instead</a>
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
				<p>Instead of deleting this rate card, you might consider:</p>
				<div class="row">
					<div class="col-md-4">
						<a href="<?php echo base_url();?>rate_cards/edit/<?php echo $fields->id; ?>" class="btn btn-warning btn-block">
							<i class="fa fa-edit"></i> Set to Inactive
						</a>
						<small class="text-muted">Disable without deleting</small>
					</div>
					<div class="col-md-4">
						<button class="btn btn-info btn-block" onclick="setExpiryDate()">
							<i class="fa fa-clock-o"></i> Set Expiry Date
						</button>
						<small class="text-muted">Schedule for expiration</small>
					</div>
					<div class="col-md-4">
						<a href="<?php echo base_url();?>rate_cards/clone_rate_card/<?php echo $fields->id; ?>" class="btn btn-success btn-block">
							<i class="fa fa-copy"></i> Clone First
						</a>
						<small class="text-muted">Create backup before deleting</small>
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
		// Enable delete button only when all confirmations are completed
		$('#confirmation, #confirmation_phrase').keyup(function(){
			checkDeleteEnabled();
		});
		
		$('#acknowledge_deletion, #understand_irreversible').change(function(){
			checkDeleteEnabled();
		});
		
		$('#deletion_reason').on('input', function(){
			checkDeleteEnabled();
		});
	});
	
	function checkDeleteEnabled(){
		var ratecardName = '<?php echo $fields->name; ?>';
		var confirmation = $('#confirmation').val();
		var confirmationPhrase = $('#confirmation_phrase').val();
		var acknowledged = $('#acknowledge_deletion').is(':checked');
		var understood = $('#understand_irreversible').is(':checked');
		var reasonProvided = $('#deletion_reason').val().trim().length > 10;
		
		if(confirmation === ratecardName && 
		   confirmationPhrase === 'DELETE PERMANENTLY' && 
		   acknowledged && understood && reasonProvided){
			$('#deleteBtn').prop('disabled', false);
			$('#deleteBtn').removeClass('btn-secondary').addClass('btn-danger');
		} else {
			$('#deleteBtn').prop('disabled', true);
			$('#deleteBtn').removeClass('btn-danger').addClass('btn-secondary');
		}
	}
	
	function confirmDelete(){
		var ratecardName = '<?php echo $fields->name; ?>';
		var assignedUsers = <?php echo $fields->assigned_users ?: 0; ?>;
		var totalRates = <?php echo $fields->total_rates ?: 0; ?>;
		
		var confirmation = $('#confirmation').val();
		var confirmationPhrase = $('#confirmation_phrase').val();
		
		if(confirmation !== ratecardName){
			alert('Please type the exact rate card name: "' + ratecardName + '"');
			return false;
		}
		
		if(confirmationPhrase !== 'DELETE PERMANENTLY'){
			alert('Please type "DELETE PERMANENTLY" in the confirmation field.');
			return false;
		}
		
		var message = 'Are you absolutely sure you want to delete rate card "' + ratecardName + '"?\n\n';
		message += 'This will permanently delete:\n';
		message += '• The rate card itself\n';
		message += '• ' + totalRates + ' associated rates\n';
		
		if(assignedUsers > 0){
			message += '• Assignments for ' + assignedUsers + ' user(s)\n';
			message += '\nWARNING: ' + assignedUsers + ' user(s) will be left without a rate card!\n';
		}
		
		message += '\nThis action CANNOT be undone!\n\n';
		message += 'Click OK to proceed with permanent deletion.';
		
		return confirm(message);
	}
	
	function setExpiryDate(){
		var today = new Date();
		var futureDate = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
		var dateString = futureDate.toISOString().split('T')[0];
		
		if(confirm('Do you want to set this rate card to expire on ' + dateString + ' instead of deleting it immediately?\n\nThis will allow existing users to continue using it until the expiry date while preventing new assignments.')){
			window.location.href = '<?php echo base_url(); ?>rate_cards/edit/<?php echo $fields->id; ?>?set_expiry=' + dateString;
		}
	}
  </script>

</body>

</html>