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
        <h3 class="mt-4">Edit Rate Card - <?php echo $fields->name; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards">Rate Cards</a></li>
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards/view/<?php echo $fields->id; ?>"><?php echo $fields->name; ?></a></li>
				<li class="breadcrumb-item active">Edit</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("rate_cards/edit/".$fields->id,$attributes);?>
		<input type="hidden" name="rate_card_id" value="<?php echo $fields->id; ?>">
		
			<!-- Current Rate Card Information -->
			<div class="card mb-4">
				<div class="card-header bg-info text-white">
					<h5>Current Rate Card Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-3">
							<div class="card bg-primary text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->name; ?></h4>
									<p>Current Name</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-success text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->currency; ?></h4>
									<p>Currency</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-warning text-white">
								<div class="card-body text-center">
									<h4><?php echo ucfirst($fields->status); ?></h4>
									<p>Status</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-info text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->provider_name ?: 'N/A'; ?></h4>
									<p>Provider</p>
								</div>
							</div>
						</div>
					</div>
					
					<div class="row mt-3">
						<div class="col-md-12">
							<table class="table table-borderless">
								<tr>
									<td><strong>Created:</strong></td>
									<td><?php echo date('Y-m-d H:i:s', strtotime($fields->created_at)); ?></td>
									<td><strong>Last Updated:</strong></td>
									<td><?php echo date('Y-m-d H:i:s', strtotime($fields->updated_at)); ?></td>
								</tr>
								<tr>
									<td><strong>Effective Date:</strong></td>
									<td><?php echo date('Y-m-d', strtotime($fields->effective_from)); ?></td>
									<td><strong>Expiry Date:</strong></td>
									<td><?php echo $fields->effective_to ? date('Y-m-d', strtotime($fields->effective_to)) : 'Never expires'; ?></td>
								</tr>
							</table>
							
							<?php if($fields->description): ?>
							<div class="mt-2">
								<strong>Current Description:</strong>
								<p class="text-muted"><?php echo $fields->description; ?></p>
							</div>
							<?php endif; ?>
						</div>
					</div>
				</div>
			</div>
		
			<!-- Basic Information -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Basic Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Rate Card Name <span class="text-danger">*</span></label>
							<input class="form-control" id="name" name="name" placeholder="Enter Rate Card Name" value="<?php echo set_value('name', $fields->name); ?>" required />
							<small class="form-text text-muted">Choose a descriptive name for this rate card</small>
						</div>
						<div class="form-group col-md-6">
							<label>Provider <span class="text-danger">*</span></label>
							<select class="form-control" id="provider_id" name="provider_id" required onchange="showProviderInfo(this.value)">
								<option value="">Select Provider</option>
								<?php foreach($providers as $provider): ?>
								<option value="<?php echo $provider->id; ?>" 
									data-description="<?php echo htmlspecialchars($provider->description); ?>"
									data-name="<?php echo htmlspecialchars($provider->name); ?>"
									<?php echo set_select('provider_id', $provider->id, ($fields->provider_id == $provider->id)); ?>>
									<?php echo $provider->name; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
					</div>
					
					<div class="row">
						<div class="form-group col-md-12">
							<label>Description</label>
							<textarea class="form-control" id="description" name="description" rows="3" placeholder="Enter description for this rate card..."><?php echo set_value('description', $fields->description); ?></textarea>
							<small class="form-text text-muted">Optional: Describe the purpose or target market for this rate card</small>
						</div>
					</div>
					
					<!-- Provider Info Panel -->
					<div id="provider_info" style="display: none;">
						<div class="alert alert-info">
							<strong>Selected Provider:</strong> <span id="selected_provider_name"><?php echo $fields->provider_name; ?></span><br>
							<strong>Description:</strong> <span id="selected_provider_desc">-</span><br>
							<strong>Contact:</strong> <span id="selected_provider_contact">-</span>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Rate Card Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Rate Card Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Currency <span class="text-danger">*</span></label>
							<select class="form-control" id="currency" name="currency" required onchange="updateCurrencyInfo(this.value)">
								<option value="">Select Currency</option>
								<option value="USD" <?php echo set_select('currency', 'USD', ($fields->currency == 'USD')); ?>>USD - US Dollar</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR', ($fields->currency == 'EUR')); ?>>EUR - Euro</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP', ($fields->currency == 'GBP')); ?>>GBP - British Pound</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR', ($fields->currency == 'PKR')); ?>>PKR - Pakistani Rupee</option>
								<option value="AED" <?php echo set_select('currency', 'AED', ($fields->currency == 'AED')); ?>>AED - UAE Dirham</option>
								<option value="CAD" <?php echo set_select('currency', 'CAD', ($fields->currency == 'CAD')); ?>>CAD - Canadian Dollar</option>
								<option value="AUD" <?php echo set_select('currency', 'AUD', ($fields->currency == 'AUD')); ?>>AUD - Australian Dollar</option>
								<option value="INR" <?php echo set_select('currency', 'INR', ($fields->currency == 'INR')); ?>>INR - Indian Rupee</option>
							</select>
							<div class="alert alert-warning mt-2">
								<small><strong>Warning:</strong> Changing currency may affect existing rates and user billing.</small>
							</div>
						</div>
						<div class="form-group col-md-6">
							<label>Status <span class="text-danger">*</span></label>
							<select class="form-control" id="status" name="status" required onchange="showStatusWarning(this.value)">
								<option value="draft" <?php echo set_select('status', 'draft', ($fields->status == 'draft')); ?>>Draft</option>
								<option value="active" <?php echo set_select('status', 'active', ($fields->status == 'active')); ?>>Active</option>
								<option value="inactive" <?php echo set_select('status', 'inactive', ($fields->status == 'inactive')); ?>>Inactive</option>
							</select>
							<small class="form-text text-muted">Status affects rate card availability for users</small>
						</div>
					</div>
					
					<div id="currency_info">
						<div class="alert alert-info">
							<strong>Currency Symbol:</strong> <span id="currency_symbol"><?php 
								$symbols = array('USD' => '$', 'EUR' => '€', 'GBP' => '£', 'PKR' => '₨', 'AED' => 'د.إ', 'CAD' => 'C$', 'AUD' => 'A$', 'INR' => '₹');
								echo $symbols[$fields->currency] ?? $fields->currency;
							?></span><br>
							<strong>Note:</strong> All rates in this rate card are in <span id="currency_name"><?php 
								$names = array('USD' => 'US Dollars', 'EUR' => 'Euros', 'GBP' => 'British Pounds', 'PKR' => 'Pakistani Rupees', 'AED' => 'UAE Dirhams', 'CAD' => 'Canadian Dollars', 'AUD' => 'Australian Dollars', 'INR' => 'Indian Rupees');
								echo $names[$fields->currency] ?? $fields->currency;
							?></span>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Effective Dates -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Effective Dates</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Effective Date <span class="text-danger">*</span></label>
							<input class="form-control" id="effective_from" name="effective_from" type="date" value="<?php echo set_value('effective_from', explode(' ', $fields->effective_from)[0]); ?>" required />
							<small class="form-text text-muted">Date when this rate card becomes active</small>
						</div>
						<div class="form-group col-md-6">
							<label>Expiry Date</label>
							<input class="form-control" id="effective_to" name="effective_to" type="date" value="<?php echo set_value('effective_to', explode(' ', $fields->effective_to)[0]); ?>" />
							<small class="form-text text-muted">Optional: Date when this rate card expires</small>
						</div>
					</div>
					
					<div class="row">
						<div class="col-md-12">
							<div class="form-check">
								<input class="form-check-input" type="checkbox" id="no_expiry" name="no_expiry" value="1" <?php echo empty($fields->effective_to) ? 'checked' : ''; ?>>
								<label class="form-check-label" for="no_expiry">
									This rate card does not expire
								</label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<hr>
			<div class="row">
				<div class="col-md-12">
					<button type="submit" class="btn btn-success btn-sm">Update Rate Card</button>
					<a href="<?php echo base_url();?>rate_cards/view/<?php echo $fields->id; ?>" class="btn btn-info btn-sm">View Details</a>
					<a href="<?php echo base_url();?>rate_cards" class="btn btn-warning btn-sm">Cancel</a>
					<a href="<?php echo base_url();?>rate_cards/delete/<?php echo $fields->id; ?>" class="btn btn-danger btn-sm">Delete Rate Card</a>
				</div>
			</div>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function(){
		// Update preview when values change
		$('#name, #currency, #status, #provider_id').on('input change', updateChangePreview);
		
		// Set initial state
		updateCurrencyInfo($('#currency').val());
		showProviderInfo($('#provider_id').val());
		
		// Handle no expiry checkbox
		$('#no_expiry').change(function(){
			if($(this).is(':checked')){
				$('#effective_to').val('').prop('disabled', true);
			} else {
				$('#effective_to').prop('disabled', false);
			}
		});
		
		// Validate dates
		$('#effective_from, #effective_to').change(function(){
			validateDates();
		});
		
		// Status change warning
		$('#status').change(function(){
			showStatusWarning($(this).val());
		});
	});
	
	function showProviderInfo(providerId){
		if(!providerId){
			$('#provider_info').hide();
			return;
		}
		
		var option = $('#provider_id option[value="' + providerId + '"]');
		if(option.length){
			$('#selected_provider_name').text(option.text());
			$('#selected_provider_desc').text(option.data('description') || 'No description available');
			$('#selected_provider_contact').text(option.data('contact') || 'No contact information');
			$('#provider_info').show();
		}
	}
	
	function updateCurrencyInfo(currency){
		if(!currency){
			return;
		}
		
		var symbols = {
			'USD': '$', 'EUR': '€', 'GBP': '£', 'PKR': '₨', 'AED': 'د.إ',
			'CAD': 'C$', 'AUD': 'A$', 'INR': '₹'
		};
		
		var names = {
			'USD': 'US Dollars', 'EUR': 'Euros', 'GBP': 'British Pounds', 
			'PKR': 'Pakistani Rupees', 'AED': 'UAE Dirhams', 'CAD': 'Canadian Dollars',
			'AUD': 'Australian Dollars', 'INR': 'Indian Rupees'
		};
		
		$('#currency_symbol').text(symbols[currency] || currency);
		$('#currency_name').text(names[currency] || currency);
	}
	
	function updateChangePreview(){
		var name = $('#name').val();
		var currency = $('#currency').val();
		var status = $('#status').val();
		var providerId = $('#provider_id').val();
		var providerName = $('#provider_id option:selected').text();
		
		// Check if any values have changed
		var originalName = '<?php echo $fields->name; ?>';
		var originalCurrency = '<?php echo $fields->currency; ?>';
		var originalStatus = '<?php echo $fields->status; ?>';
		var originalProvider = '<?php echo $fields->provider_name; ?>';
		
		var hasChanges = (name !== originalName || currency !== originalCurrency || 
						 status !== originalStatus || providerName !== originalProvider);
		
		if(hasChanges){
			$('#new_name').text(name);
			$('#new_currency').text(currency);
			$('#new_status').text(ucfirst(status));
			$('#new_provider').text(providerName);
			$('#change_preview').show();
		} else {
			$('#change_preview').hide();
		}
	}
	
	function showStatusWarning(status){
		var assignedUsers = <?php echo $fields->assigned_users ?: 0; ?>;
		
		if(assignedUsers > 0 && (status === 'inactive' || status === 'draft')){
			if(!confirm('This rate card is assigned to ' + assignedUsers + ' user(s). Changing status to "' + status + '" may affect their ability to make calls. Are you sure you want to continue?')){
				$('#status').val('<?php echo $fields->status; ?>');
			}
		}
	}
	
	function validateDates(){
		var effectiveDate = new Date($('#effective_from').val());
		var expiryDate = new Date($('#effective_to').val());
		
		if($('#expiry_date').val() && effectiveDate >= expiryDate){
			alert('Expiry date must be after the effective date.');
			$('#effective_to').focus();
		}
	}
	
	function ucfirst(str){
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
  </script>

</body>

</html>