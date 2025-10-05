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
        <h3 class="mt-4">Add Rate Card</h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards">Rate Cards</a></li>
				<li class="breadcrumb-item active">Add Rate Card</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("rate_cards/add",$attributes);?>
		
			<!-- Basic Information -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Basic Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Rate Card Name <span class="text-danger">*</span></label>
							<input class="form-control" id="name" name="name" placeholder="Enter Rate Card Name" value="<?php echo set_value('name'); ?>" required />
							<small class="form-text text-muted">Choose a descriptive name for this rate card</small>
						</div>
						<div class="form-group col-md-6">
							<label>Provider <span class="text-danger">*</span></label>
							<select class="form-control" id="provider_id" name="provider_id" required onchange="showProviderInfo(this.value)">
								<option value="">Select Provider</option>
								<?php foreach($providers as $provider): ?>
								<option value="<?php echo $provider->id; ?>" 
									data-description="<?php echo htmlspecialchars($provider->description); ?>"
									data-contact="<?php echo htmlspecialchars($provider->contact_info); ?>"
									<?php echo set_select('provider_id', $provider->id); ?>>
									<?php echo $provider->name; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
					</div>
					
					<div class="row">
						<div class="form-group col-md-12">
							<label>Description</label>
							<textarea class="form-control" id="description" name="description" rows="3" placeholder="Enter description for this rate card..."><?php echo set_value('description'); ?></textarea>
							<small class="form-text text-muted">Optional: Describe the purpose or target market for this rate card</small>
						</div>
					</div>
					
					<!-- Provider Info Panel -->
					<div id="provider_info" style="display: none;">
						<div class="alert alert-info">
							<strong>Selected Provider:</strong> <span id="selected_provider_name"></span><br>
							<strong>Description:</strong> <span id="selected_provider_desc"></span><br>
							<strong>Contact:</strong> <span id="selected_provider_contact"></span>
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
								<option value="USD" <?php echo set_select('currency', 'USD', TRUE); ?>>USD - US Dollar</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR'); ?>>EUR - Euro</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP'); ?>>GBP - British Pound</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR'); ?>>PKR - Pakistani Rupee</option>
								<option value="AED" <?php echo set_select('currency', 'AED'); ?>>AED - UAE Dirham</option>
								<option value="CAD" <?php echo set_select('currency', 'CAD'); ?>>CAD - Canadian Dollar</option>
								<option value="AUD" <?php echo set_select('currency', 'AUD'); ?>>AUD - Australian Dollar</option>
								<option value="INR" <?php echo set_select('currency', 'INR'); ?>>INR - Indian Rupee</option>
							</select>
						</div>
						<div class="form-group col-md-6">
							<label>Status</label>
							<select class="form-control" id="status" name="status" required>
								<option value="draft" <?php echo set_select('status', 'draft', TRUE); ?>>Draft</option>
								<option value="active" <?php echo set_select('status', 'active'); ?>>Active</option>
								<option value="inactive" <?php echo set_select('status', 'inactive'); ?>>Inactive</option>
							</select>
							<small class="form-text text-muted">New rate cards typically start as Draft</small>
						</div>
					</div>
					
					<div id="currency_info" style="display: none;">
						<div class="alert alert-warning">
							<strong>Currency Symbol:</strong> <span id="currency_symbol"></span><br>
							<strong>Note:</strong> All rates in this rate card will be in <span id="currency_name"></span>
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
							<input class="form-control" id="effective_date" name="effective_date" type="date" value="<?php echo set_value('effective_date', date('Y-m-d')); ?>" required />
							<small class="form-text text-muted">Date when this rate card becomes active</small>
						</div>
						<div class="form-group col-md-6">
							<label>Expiry Date</label>
							<input class="form-control" id="expiry_date" name="expiry_date" type="date" value="<?php echo set_value('expiry_date'); ?>" />
							<small class="form-text text-muted">Optional: Date when this rate card expires</small>
						</div>
					</div>
					
					<div class="row">
						<div class="col-md-12">
							<div class="form-check">
								<input class="form-check-input" type="checkbox" id="no_expiry" name="no_expiry" value="1" checked>
								<label class="form-check-label" for="no_expiry">
									This rate card does not expire
								</label>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Rate Card Preview -->
			<div class="card mb-4" id="rate_card_preview" style="display: none;">
				<div class="card-header bg-info text-white">
					<h5>Rate Card Preview</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-6">
							<table class="table table-borderless">
								<tr>
									<td><strong>Name:</strong></td>
									<td id="preview_name">-</td>
								</tr>
								<tr>
									<td><strong>Provider:</strong></td>
									<td id="preview_provider">-</td>
								</tr>
								<tr>
									<td><strong>Currency:</strong></td>
									<td id="preview_currency">-</td>
								</tr>
							</table>
						</div>
						<div class="col-md-6">
							<table class="table table-borderless">
								<tr>
									<td><strong>Status:</strong></td>
									<td id="preview_status">-</td>
								</tr>
								<tr>
									<td><strong>Effective Date:</strong></td>
									<td id="preview_effective">-</td>
								</tr>
								<tr>
									<td><strong>Expiry Date:</strong></td>
									<td id="preview_expiry">-</td>
								</tr>
							</table>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<strong>Description:</strong>
							<p id="preview_description" class="text-muted">-</p>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Next Steps Info -->
			<div class="card mb-4">
				<div class="card-header bg-success text-white">
					<h5>After Creating Rate Card</h5>
				</div>
				<div class="card-body">
					<p>Once you create this rate card, you can:</p>
					<ul>
						<li><strong>Add Individual Rates:</strong> Add rates for specific destinations one by one</li>
						<li><strong>Bulk Upload Rates:</strong> Upload rates from a CSV file for faster setup</li>
						<li><strong>Clone from Existing:</strong> Copy rates from another rate card as a starting point</li>
						<li><strong>Assign to Users:</strong> Assign this rate card to users for billing</li>
					</ul>
					<div class="alert alert-info">
						<strong>Tip:</strong> Start with "Draft" status to test your rates before making the rate card active.
					</div>
				</div>
			</div>
			
			<hr>
			<button type="submit" class="btn btn-success btn-sm">Create Rate Card</button>
			<a href="<?php echo base_url();?>rate_cards" class="btn btn-warning btn-sm">Cancel</a>
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
		$('#name, #description, #currency, #status, #effective_date, #expiry_date').on('input change', updatePreview);
		$('#provider_id').on('change', function(){
			showProviderInfo(this.value);
			updatePreview();
		});
		
		// Handle no expiry checkbox
		$('#no_expiry').change(function(){
			if($(this).is(':checked')){
				$('#expiry_date').val('').prop('disabled', true);
			} else {
				$('#expiry_date').prop('disabled', false);
			}
			updatePreview();
		});
		
		// Validate dates
		$('#effective_date, #expiry_date').change(function(){
			validateDates();
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
			$('#currency_info').hide();
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
		$('#currency_info').show();
	}
	
	function updatePreview(){
		var name = $('#name').val();
		var providerId = $('#provider_id').val();
		var currency = $('#currency').val();
		var status = $('#status').val();
		var effectiveDate = $('#effective_date').val();
		var expiryDate = $('#expiry_date').val();
		var noExpiry = $('#no_expiry').is(':checked');
		var description = $('#description').val();
		
		if(!name || !providerId || !currency){
			$('#rate_card_preview').hide();
			return;
		}
		
		var providerName = $('#provider_id option:selected').text();
		
		$('#preview_name').text(name);
		$('#preview_provider').text(providerName);
		$('#preview_currency').text(currency);
		$('#preview_status').html('<span class="badge badge-' + getStatusClass(status) + '">' + ucfirst(status) + '</span>');
		$('#preview_effective').text(effectiveDate || 'Not set');
		$('#preview_expiry').text(noExpiry ? 'Never expires' : (expiryDate || 'Not set'));
		$('#preview_description').text(description || 'No description provided');
		
		$('#rate_card_preview').show();
	}
	
	function validateDates(){
		var effectiveDate = new Date($('#effective_date').val());
		var expiryDate = new Date($('#expiry_date').val());
		
		if($('#expiry_date').val() && effectiveDate >= expiryDate){
			alert('Expiry date must be after the effective date.');
			$('#expiry_date').focus();
		}
	}
	
	function getStatusClass(status){
		switch(status){
			case 'active': return 'success';
			case 'inactive': return 'secondary';
			case 'draft': return 'warning';
			default: return 'secondary';
		}
	}
	
	function ucfirst(str){
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
  </script>

</body>

</html>